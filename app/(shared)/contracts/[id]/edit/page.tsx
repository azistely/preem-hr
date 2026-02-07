import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, FileEdit, Lock, AlertTriangle } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { employmentContracts } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { ContractForm } from '../../components/contract-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Modifier contrat | Jamana',
  description: 'Modifier un contrat de travail existant',
};

interface EditContractPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditContractPage({ params }: EditContractPageProps) {
  const { id } = await params;

  // Get user session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Fetch contract data
  const [contract] = await db
    .select({
      id: employmentContracts.id,
      employeeId: employmentContracts.employeeId,
      contractType: employmentContracts.contractType,
      startDate: employmentContracts.startDate,
      contractHtmlContent: employmentContracts.contractHtmlContent,
      contractNumber: employmentContracts.contractNumber,
      signedDate: employmentContracts.signedDate,
    })
    .from(employmentContracts)
    .where(eq(employmentContracts.id, id))
    .limit(1);

  if (!contract) {
    notFound();
  }

  // Check if contract is signed - signed contracts cannot be edited
  const isSigned = !!contract.signedDate;

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/contracts" className="hover:text-foreground transition-colors">
          Contrats
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">
          {isSigned ? 'Voir' : 'Modifier'} {contract.contractNumber || contract.contractType}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${isSigned ? 'bg-orange-100' : 'bg-primary/10'}`}>
            {isSigned ? (
              <Lock className="h-6 w-6 text-orange-600" />
            ) : (
              <FileEdit className="h-6 w-6 text-primary" />
            )}
          </div>
          <h1 className="text-3xl font-bold">
            {isSigned ? 'Contrat signé' : 'Modifier contrat'} {contract.contractNumber || contract.contractType}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {isSigned
            ? 'Ce contrat a été signé et ne peut plus être modifié. Pour apporter des modifications, créez un avenant.'
            : 'Modifiez le contenu du contrat et sauvegardez en brouillon ou générez le PDF final.'}
        </p>
      </div>

      {/* Signed Contract Warning */}
      {isSigned && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-orange-900">Contrat verrouillé</AlertTitle>
          <AlertDescription className="text-orange-800">
            Ce contrat a été signé le{' '}
            {new Date(contract.signedDate!).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            . Les contrats signés sont des documents légaux qui ne peuvent pas être modifiés.
            Pour apporter des modifications, vous devez créer un avenant (addendum) au contrat.
          </AlertDescription>
          <div className="mt-4 flex gap-2">
            <Button asChild variant="outline">
              <Link href="/contracts">
                Retour aux contrats
              </Link>
            </Button>
            {/* TODO: Add "Créer un avenant" button when amendment feature is implemented */}
          </div>
        </Alert>
      )}

      {/* Contract Form - Read-only if signed */}
      {!isSigned && (
        <ContractForm
          mode="edit"
          contractId={contract.id}
          initialData={{
            employeeId: contract.employeeId,
            contractType: contract.contractType as 'CDI' | 'CDD' | 'CDDTI' | 'STAGE' | 'INTERIM',
            startDate: contract.startDate || new Date().toISOString().split('T')[0],
            contractHtmlContent: contract.contractHtmlContent || '',
          }}
        />
      )}
    </div>
  );
}
