/**
 * Monthly Leave Accrual Edge Function
 *
 * Runs on the 1st of every month to accrue leave balances for all active employees.
 *
 * Convention Collective Requirements (Article 28):
 * - Standard: 2.0 days/month = 24 days/year
 * - Age-based: Under 21 = 2.5 days/month = 30 days/year
 * - Seniority bonus:
 *   - 15 years: +2 days/year
 *   - 20 years: +4 days/year
 *   - 25 years: +6 days/year
 * - Pro-rating: Mid-month hires get proportional accrual
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Types
interface Employee {
  id: string;
  tenant_id: string;
  hire_date: string;
  date_of_birth: string | null;
  status: string;
}

interface TimeOffBalance {
  id: string;
  employee_id: string;
  policy_id: string;
  balance: string;
  period_start: string;
  period_end: string;
}

interface AccrualResult {
  employee_id: string;
  employee_name: string;
  accrued_days: number;
  new_balance: number;
  reason: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Validate request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Accrue Leave] Starting monthly leave accrual...');

    const accrualDate = new Date();
    const results: AccrualResult[] = [];

    // Get all active employees
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, tenant_id, first_name, last_name, hire_date, date_of_birth, status')
      .eq('status', 'active');

    if (employeesError) {
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }

    console.log(`[Accrue Leave] Found ${employees?.length || 0} active employees`);

    // Get active annual leave policy (effective_to is null)
    const { data: annualLeavePolicy, error: policyError } = await supabase
      .from('time_off_policies')
      .select('id')
      .eq('policy_type', 'annual_leave')
      .is('effective_to', null)
      .limit(1)
      .single();

    if (policyError || !annualLeavePolicy) {
      throw new Error('Annual leave policy not found');
    }

    // Process each employee
    for (const emp of employees || []) {
      try {
        // Calculate age (as of December 31 of current year)
        let age = 100; // Default to adult
        if (emp.date_of_birth) {
          const birthDate = new Date(emp.date_of_birth);
          const currentYear = accrualDate.getFullYear();
          const dec31 = new Date(currentYear, 11, 31); // December 31
          age = dec31.getFullYear() - birthDate.getFullYear();
        }

        // Calculate seniority (years of service)
        const hireDate = new Date(emp.hire_date);
        const seniority = accrualDate.getFullYear() - hireDate.getFullYear();

        // Determine accrual rate (Article 28)
        let monthlyRate = 2.0; // Standard CI rate
        if (age < 21) {
          monthlyRate = 2.5; // Under 21 gets 30 days/year
        }

        // Calculate seniority bonus (added to annual total, then pro-rated monthly)
        let bonusDays = 0;
        if (seniority >= 25) bonusDays = 6;
        else if (seniority >= 20) bonusDays = 4;
        else if (seniority >= 15) bonusDays = 2;

        // Total annual days = (monthly rate * 12) + bonus
        const totalAnnual = monthlyRate * 12 + bonusDays;
        const monthlyAccrual = totalAnnual / 12;

        // Pro-rate if hired mid-month
        let accrualAmount = monthlyAccrual;
        const hireMonth = hireDate.getMonth();
        const hireYear = hireDate.getFullYear();
        const accrualMonth = accrualDate.getMonth();
        const accrualYear = accrualDate.getFullYear();

        if (hireYear === accrualYear && hireMonth === accrualMonth) {
          // Hired this month - pro-rate
          const daysInMonth = new Date(accrualYear, accrualMonth + 1, 0).getDate();
          const daysWorked = daysInMonth - hireDate.getDate() + 1;
          accrualAmount = (monthlyAccrual * daysWorked) / daysInMonth;
        }

        // Get or create balance for this employee
        const { data: existingBalance } = await supabase
          .from('time_off_balances')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('policy_id', annualLeavePolicy.id)
          .single();

        if (!existingBalance) {
          // Create new balance
          const periodStart = new Date(accrualYear, 0, 1).toISOString().split('T')[0];
          const periodEnd = new Date(accrualYear, 11, 31).toISOString().split('T')[0];

          await supabase.from('time_off_balances').insert({
            tenant_id: emp.tenant_id,
            employee_id: emp.id,
            policy_id: annualLeavePolicy.id,
            balance: accrualAmount.toFixed(2),
            used: '0',
            pending: '0',
            period_start: periodStart,
            period_end: periodEnd,
            last_accrual_date: accrualDate.toISOString().split('T')[0],
          });

          results.push({
            employee_id: emp.id,
            employee_name: `${emp.first_name} ${emp.last_name}`,
            accrued_days: parseFloat(accrualAmount.toFixed(2)),
            new_balance: parseFloat(accrualAmount.toFixed(2)),
            reason: 'New balance created',
          });
        } else {
          // Update existing balance
          const currentBalance = parseFloat(existingBalance.balance);
          const newBalance = currentBalance + accrualAmount;

          await supabase
            .from('time_off_balances')
            .update({
              balance: newBalance.toFixed(2),
              last_accrual_date: accrualDate.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBalance.id);

          results.push({
            employee_id: emp.id,
            employee_name: `${emp.first_name} ${emp.last_name}`,
            accrued_days: parseFloat(accrualAmount.toFixed(2)),
            new_balance: parseFloat(newBalance.toFixed(2)),
            reason: `Monthly accrual (${monthlyRate} days/month, ${bonusDays > 0 ? `+${bonusDays/12} bonus` : 'no bonus'})`,
          });
        }
      } catch (error) {
        console.error(`[Accrue Leave] Error processing employee ${emp.id}:`, error);
        results.push({
          employee_id: emp.id,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          accrued_days: 0,
          new_balance: 0,
          reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    console.log(`[Accrue Leave] Completed accrual for ${results.length} employees`);

    return new Response(
      JSON.stringify({
        success: true,
        accrual_date: accrualDate.toISOString(),
        total_employees: results.length,
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Accrue Leave] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
