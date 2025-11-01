"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface WorkflowCondition {
  field: string;
  operator: string;
  value: string | number;
}

interface ConditionBuilderProps {
  conditions: WorkflowCondition[];
  onChange: (conditions: WorkflowCondition[]) => void;
}

// Note: employee.contractType is a UI field option for workflow builder.
// Actual contract data is retrieved via JOIN with employment_contracts table
// using employee.currentContractId FK. See employee.service.ts:getEmployeeById
const FIELD_OPTIONS = [
  { value: "employee.baseSalary", label: "Salaire de base" },
  { value: "employee.department", label: "Département" },
  { value: "employee.contractType", label: "Type de contrat" }, // Display field - data from employment_contracts table
  { value: "employee.position", label: "Poste" },
  { value: "employee.sector", label: "Secteur d'activité" },
  { value: "salary.changePercentage", label: "Pourcentage d'augmentation" },
  { value: "leave.daysCount", label: "Nombre de jours de congé" },
  { value: "leave.type", label: "Type de congé" },
];

const OPERATOR_OPTIONS = [
  { value: "eq", label: "est égal à", types: ["number", "text"] },
  { value: "ne", label: "est différent de", types: ["number", "text"] },
  { value: "gt", label: "est supérieur à", types: ["number"] },
  { value: "gte", label: "est supérieur ou égal à", types: ["number"] },
  { value: "lt", label: "est inférieur à", types: ["number"] },
  { value: "lte", label: "est inférieur ou égal à", types: ["number"] },
  { value: "contains", label: "contient", types: ["text"] },
  { value: "in", label: "est parmi", types: ["text"] },
];

const FIELD_TYPES: Record<string, "number" | "text"> = {
  "employee.baseSalary": "number",
  "employee.department": "text",
  "employee.contractType": "text",
  "employee.position": "text",
  "employee.sector": "text",
  "salary.changePercentage": "number",
  "leave.daysCount": "number",
  "leave.type": "text",
};

const FIELD_EXAMPLES: Record<string, string> = {
  "employee.baseSalary": "Ex: 500000",
  "employee.department": "Ex: IT",
  "employee.contractType": "Ex: CDI",
  "employee.position": "Ex: Développeur",
  "employee.sector": "Ex: services",
  "salary.changePercentage": "Ex: 15",
  "leave.daysCount": "Ex: 5",
  "leave.type": "Ex: unpaid",
};

export function ConditionBuilder({ conditions, onChange }: ConditionBuilderProps) {
  const addCondition = () => {
    onChange([
      ...conditions,
      { field: "", operator: "", value: "" },
    ]);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<WorkflowCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };

    // Reset operator and value if field changes
    if (updates.field !== undefined) {
      newConditions[index].operator = "";
      newConditions[index].value = "";
    }

    onChange(newConditions);
  };

  const getAvailableOperators = (field: string) => {
    const fieldType = FIELD_TYPES[field];
    if (!fieldType) return OPERATOR_OPTIONS;

    return OPERATOR_OPTIONS.filter((op) => op.types.includes(fieldType));
  };

  const getInputType = (field: string): "text" | "number" => {
    return FIELD_TYPES[field] === "number" ? "number" : "text";
  };

  return (
    <div className="space-y-4">
      {conditions.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-4">
            Aucune condition ajoutée
          </p>
          <Button onClick={addCondition} variant="outline" className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une condition
          </Button>
        </div>
      ) : (
        <>
          {conditions.map((condition, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-4">
                    {/* Field Selection */}
                    <div>
                      <Label htmlFor={`field-${index}`} className="text-sm mb-2 block">
                        Champ
                      </Label>
                      <Select
                        value={condition.field}
                        onValueChange={(value) => updateCondition(index, { field: value })}
                      >
                        <SelectTrigger id={`field-${index}`} className="min-h-[44px]">
                          <SelectValue placeholder="Sélectionnez un champ" />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Operator Selection */}
                    {condition.field && (
                      <div>
                        <Label htmlFor={`operator-${index}`} className="text-sm mb-2 block">
                          Opérateur
                        </Label>
                        <Select
                          value={condition.operator}
                          onValueChange={(value) => updateCondition(index, { operator: value })}
                        >
                          <SelectTrigger id={`operator-${index}`} className="min-h-[44px]">
                            <SelectValue placeholder="Sélectionnez un opérateur" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableOperators(condition.field).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Value Input */}
                    {condition.field && condition.operator && (
                      <div>
                        <Label htmlFor={`value-${index}`} className="text-sm mb-2 block">
                          Valeur
                        </Label>
                        <Input
                          id={`value-${index}`}
                          type={getInputType(condition.field)}
                          value={condition.value}
                          onChange={(e) =>
                            updateCondition(index, {
                              value:
                                getInputType(condition.field) === "number"
                                  ? parseFloat(e.target.value) || 0
                                  : e.target.value,
                            })
                          }
                          placeholder={FIELD_EXAMPLES[condition.field] || "Entrez une valeur"}
                          className="min-h-[44px]"
                        />
                      </div>
                    )}

                    {/* Preview */}
                    {condition.field && condition.operator && condition.value && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                          <span className="font-medium">Si</span>{" "}
                          <span className="font-semibold">
                            {FIELD_OPTIONS.find((f) => f.value === condition.field)?.label}
                          </span>{" "}
                          <span className="font-medium">
                            {OPERATOR_OPTIONS.find((o) => o.value === condition.operator)?.label}
                          </span>{" "}
                          <span className="font-semibold">{condition.value}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(index)}
                    className="min-h-[44px] min-w-[44px] flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add More Button */}
          <Button onClick={addCondition} variant="outline" className="w-full min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une autre condition
          </Button>

          {conditions.length > 1 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Note:</span> Toutes les conditions doivent être remplies (logique ET).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
