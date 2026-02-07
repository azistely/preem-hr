import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, FileText } from 'lucide-react';
import { ContractForm } from '../components/contract-form';

export const metadata: Metadata = {
  title: 'Nouveau contrat | Jamana',
  description: 'Créer un nouveau contrat de travail',
};

export default function NewContractPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/contracts" className="hover:text-foreground transition-colors">
          Contrats
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Nouveau contrat</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Nouveau contrat</h1>
        </div>
        <p className="text-muted-foreground">
          Créez un nouveau contrat de travail en remplissant les informations essentielles et en
          rédigeant le contenu.
        </p>
      </div>

      {/* Contract Form */}
      <ContractForm mode="create" />
    </div>
  );
}
