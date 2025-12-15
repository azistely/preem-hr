/**
 * Printable Evaluation Form Component
 *
 * Renders an evaluation in a print-friendly A4 layout with:
 * - Clean typography and spacing
 * - All evaluation sections (employee info, objectives, competencies, comments)
 * - Signature lines (employee, manager, 2 witnesses)
 * - Professional design (no emojis)
 * - QR code linking to digital entry (optional)
 *
 * @usage
 * <PrintableEvaluationForm evaluation={evaluation} qrCodeUrl={url} />
 */

'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';

// Types for evaluation data
type ObjectiveLevel = 'company' | 'team' | 'individual';

interface Objective {
  id: string;
  title: string;
  description?: string | null;
  objectiveLevel: ObjectiveLevel;
  targetValue?: string | null;
  targetUnit?: string | null;
  currentValue?: string | null;
  weight?: string | null;
}

interface ObjectiveScore {
  objectiveId: string;
  score: number;
  comment?: string | null;
}

interface Competency {
  id: string;
  name: string;
  description?: string | null;
  category: string;
}

interface PositionCompetency {
  competency: Competency;
  requiredLevel: number;
  isCritical?: boolean;
}

interface CompetencyRating {
  competencyId: string;
  rating: number;
  comment?: string | null;
  expectedLevel?: number | null;
}

interface Employee {
  firstName: string;
  lastName: string;
  employeeNumber?: string | null;
  jobTitle?: string | null;
  department?: { name: string } | null;
}

interface Cycle {
  name: string;
  periodStart: string;
  periodEnd: string;
}

interface EvaluationData {
  id: string;
  evaluationType: 'self' | 'manager' | 'peer' | '360_report';
  status: string;
  employee?: Employee | null;
  cycle?: Cycle | null;
  objectives?: Objective[] | null;
  objectiveScores?: ObjectiveScore[] | null;
  positionCompetencies?: PositionCompetency[] | null;
  competencyRatings?: CompetencyRating[] | null;
  overallRating?: string | null;
  overallScore?: string | null;
  strengthsComment?: string | null;
  improvementAreasComment?: string | null;
  developmentPlanComment?: string | null;
  generalComment?: string | null;
  submittedAt?: string | null;
  validatedAt?: string | null;
}

interface PrintableEvaluationFormProps {
  evaluation: EvaluationData;
  qrCodeUrl?: string;
  showBlankFields?: boolean; // For printing blank forms to fill by hand
}

// Rating labels (professional, no emojis)
const ratingLabels: Record<number, string> = {
  1: 'Insuffisant',
  2: 'A ameliorer',
  3: 'Satisfaisant',
  4: 'Tres bien',
  5: 'Excellent',
};

const typeLabels: Record<string, string> = {
  self: 'Auto-evaluation',
  manager: 'Evaluation manager',
  peer: 'Evaluation par les pairs',
  '360_report': 'Evaluation 360',
};

const levelLabels: Record<ObjectiveLevel, string> = {
  company: 'Entreprise',
  team: 'Equipe',
  individual: 'Individuel',
};

const categoryLabels: Record<string, string> = {
  technique: 'Technique',
  comportemental: 'Comportemental',
  leadership: 'Leadership',
  metier: 'Metier',
};

export function PrintableEvaluationForm({
  evaluation,
  qrCodeUrl,
  showBlankFields = false,
}: PrintableEvaluationFormProps) {
  const objectiveScoresMap = new Map(
    (evaluation.objectiveScores ?? []).map(s => [s.objectiveId, s])
  );

  const competencyRatingsMap = new Map(
    (evaluation.competencyRatings ?? []).map(r => [r.competencyId, r])
  );

  // Group objectives by level
  const objectivesByLevel = {
    company: evaluation.objectives?.filter(o => o.objectiveLevel === 'company') ?? [],
    team: evaluation.objectives?.filter(o => o.objectiveLevel === 'team') ?? [],
    individual: evaluation.objectives?.filter(o => o.objectiveLevel === 'individual') ?? [],
  };

  // Calculate average score
  const averageScore = evaluation.objectiveScores && evaluation.objectiveScores.length > 0
    ? Math.round(
        evaluation.objectiveScores.reduce((sum, s) => sum + s.score, 0) /
        evaluation.objectiveScores.length
      )
    : null;

  return (
    <div className="print-evaluation-form">
      {/* Header */}
      <header className="print-header">
        <div className="print-header-content">
          <h1 className="print-title">FICHE D&apos;EVALUATION</h1>
          <p className="print-subtitle">{typeLabels[evaluation.evaluationType]}</p>
          {evaluation.cycle && (
            <p className="print-period">
              Periode: {format(new Date(evaluation.cycle.periodStart), 'dd MMM yyyy', { locale: fr })}
              {' - '}
              {format(new Date(evaluation.cycle.periodEnd), 'dd MMM yyyy', { locale: fr })}
            </p>
          )}
        </div>
        {qrCodeUrl && (
          <div className="print-qr-code">
            <QRCodeSVG value={qrCodeUrl} size={60} />
            <span className="print-qr-label">Version numerique</span>
          </div>
        )}
      </header>

      {/* Employee Information */}
      <section className="print-section">
        <h2 className="print-section-title">INFORMATIONS DE L&apos;EMPLOYE</h2>
        <div className="print-info-grid">
          <div className="print-info-row">
            <span className="print-info-label">Nom et Prenom:</span>
            <span className="print-info-value">
              {showBlankFields ? '_'.repeat(40) : `${evaluation.employee?.firstName ?? ''} ${evaluation.employee?.lastName ?? ''}`}
            </span>
          </div>
          <div className="print-info-row">
            <span className="print-info-label">Matricule:</span>
            <span className="print-info-value">
              {showBlankFields ? '_'.repeat(20) : (evaluation.employee?.employeeNumber ?? '-')}
            </span>
          </div>
          <div className="print-info-row">
            <span className="print-info-label">Poste:</span>
            <span className="print-info-value">
              {showBlankFields ? '_'.repeat(30) : (evaluation.employee?.jobTitle ?? '-')}
            </span>
          </div>
          <div className="print-info-row">
            <span className="print-info-label">Departement:</span>
            <span className="print-info-value">
              {showBlankFields ? '_'.repeat(30) : (evaluation.employee?.department?.name ?? '-')}
            </span>
          </div>
        </div>
      </section>

      {/* Objectives Section */}
      {(evaluation.objectives?.length ?? 0) > 0 && (
        <section className="print-section">
          <h2 className="print-section-title">EVALUATION DES OBJECTIFS</h2>

          {(['company', 'team', 'individual'] as const).map(level => {
            const levelObjectives = objectivesByLevel[level];
            if (levelObjectives.length === 0) return null;

            return (
              <div key={level} className="print-objective-group">
                <h3 className="print-objective-level">{levelLabels[level]}</h3>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Objectif</th>
                      <th style={{ width: '15%' }}>Cible</th>
                      <th style={{ width: '10%' }}>Poids</th>
                      <th style={{ width: '15%' }}>Score (%)</th>
                      <th style={{ width: '20%' }}>Commentaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levelObjectives.map(objective => {
                      const score = objectiveScoresMap.get(objective.id);
                      return (
                        <tr key={objective.id}>
                          <td>
                            <strong>{objective.title}</strong>
                            {objective.description && (
                              <p className="print-objective-desc">{objective.description}</p>
                            )}
                          </td>
                          <td className="print-center">
                            {objective.targetValue ?? '-'}
                            {objective.targetUnit && ` ${objective.targetUnit}`}
                          </td>
                          <td className="print-center">{objective.weight ?? '-'}%</td>
                          <td className="print-center">
                            {showBlankFields ? '____' : (score?.score ?? '-')}
                          </td>
                          <td>
                            {showBlankFields ? (
                              <div className="print-blank-line" />
                            ) : (
                              score?.comment ?? ''
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Average Score */}
          <div className="print-score-summary">
            <span className="print-score-label">Score moyen des objectifs:</span>
            <span className="print-score-value">
              {showBlankFields ? '____' : (averageScore !== null ? `${averageScore}%` : '-')}
            </span>
          </div>
        </section>
      )}

      {/* Competencies Section */}
      {(evaluation.positionCompetencies?.length ?? 0) > 0 && (
        <section className="print-section">
          <h2 className="print-section-title">EVALUATION DES COMPETENCES</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Competence</th>
                <th style={{ width: '15%' }}>Categorie</th>
                <th style={{ width: '10%' }}>Niveau Requis</th>
                <th style={{ width: '10%' }}>Note</th>
                <th style={{ width: '15%' }}>Ecart</th>
                <th style={{ width: '25%' }}>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.positionCompetencies?.map(pc => {
                const rating = competencyRatingsMap.get(pc.competency.id);
                const gap = rating ? rating.rating - pc.requiredLevel : null;

                return (
                  <tr key={pc.competency.id}>
                    <td>
                      <strong>{pc.competency.name}</strong>
                      {pc.isCritical && <span className="print-critical"> (Critique)</span>}
                    </td>
                    <td className="print-center">
                      {categoryLabels[pc.competency.category] ?? pc.competency.category}
                    </td>
                    <td className="print-center">{pc.requiredLevel}</td>
                    <td className="print-center">
                      {showBlankFields ? '____' : (rating?.rating ?? '-')}
                    </td>
                    <td className="print-center">
                      {showBlankFields ? '____' : (
                        gap !== null ? (
                          <span className={gap >= 0 ? 'print-gap-positive' : 'print-gap-negative'}>
                            {gap >= 0 ? `+${gap}` : gap}
                          </span>
                        ) : '-'
                      )}
                    </td>
                    <td>
                      {showBlankFields ? (
                        <div className="print-blank-line" />
                      ) : (
                        rating?.comment ?? ''
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Overall Rating */}
      <section className="print-section">
        <h2 className="print-section-title">NOTE GLOBALE</h2>
        <div className="print-rating-box">
          <div className="print-rating-scale">
            {[1, 2, 3, 4, 5].map(rating => (
              <div
                key={rating}
                className={`print-rating-option ${
                  !showBlankFields && evaluation.overallRating === String(rating)
                    ? 'print-rating-selected'
                    : ''
                }`}
              >
                <span className="print-rating-number">{rating}</span>
                <span className="print-rating-label">{ratingLabels[rating]}</span>
              </div>
            ))}
          </div>
          {showBlankFields && (
            <p className="print-rating-instruction">Encerclez la note attribuee</p>
          )}
        </div>
      </section>

      {/* Comments Sections */}
      <section className="print-section">
        <h2 className="print-section-title">COMMENTAIRES</h2>

        <div className="print-comment-box">
          <h3 className="print-comment-title">Points forts</h3>
          {showBlankFields ? (
            <div className="print-blank-area" style={{ minHeight: '60px' }} />
          ) : (
            <p className="print-comment-text">{evaluation.strengthsComment || '-'}</p>
          )}
        </div>

        <div className="print-comment-box">
          <h3 className="print-comment-title">Axes d&apos;amelioration</h3>
          {showBlankFields ? (
            <div className="print-blank-area" style={{ minHeight: '60px' }} />
          ) : (
            <p className="print-comment-text">{evaluation.improvementAreasComment || '-'}</p>
          )}
        </div>

        <div className="print-comment-box">
          <h3 className="print-comment-title">Plan de developpement</h3>
          {showBlankFields ? (
            <div className="print-blank-area" style={{ minHeight: '60px' }} />
          ) : (
            <p className="print-comment-text">{evaluation.developmentPlanComment || '-'}</p>
          )}
        </div>

        <div className="print-comment-box">
          <h3 className="print-comment-title">Commentaire general</h3>
          {showBlankFields ? (
            <div className="print-blank-area" style={{ minHeight: '60px' }} />
          ) : (
            <p className="print-comment-text">{evaluation.generalComment || '-'}</p>
          )}
        </div>
      </section>

      {/* Signatures */}
      <section className="print-section print-signatures">
        <h2 className="print-section-title">SIGNATURES</h2>
        <div className="print-signature-grid">
          <div className="print-signature-box">
            <p className="print-signature-role">L&apos;employe</p>
            <div className="print-signature-line" />
            <p className="print-signature-name">
              {evaluation.employee?.firstName} {evaluation.employee?.lastName}
            </p>
            <p className="print-signature-date">
              Date: {showBlankFields ? '___/___/______' : format(new Date(), 'dd/MM/yyyy')}
            </p>
          </div>

          <div className="print-signature-box">
            <p className="print-signature-role">Le Manager</p>
            <div className="print-signature-line" />
            <p className="print-signature-name">Nom: _________________________</p>
            <p className="print-signature-date">
              Date: {showBlankFields ? '___/___/______' : format(new Date(), 'dd/MM/yyyy')}
            </p>
          </div>

          <div className="print-signature-box">
            <p className="print-signature-role">Temoin 1</p>
            <div className="print-signature-line" />
            <p className="print-signature-name">Nom: _________________________</p>
            <p className="print-signature-date">Date: ___/___/______</p>
          </div>

          <div className="print-signature-box">
            <p className="print-signature-role">Temoin 2</p>
            <div className="print-signature-line" />
            <p className="print-signature-name">Nom: _________________________</p>
            <p className="print-signature-date">Date: ___/___/______</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="print-footer">
        <p>Document genere le {format(new Date(), 'dd MMMM yyyy a HH:mm', { locale: fr })}</p>
        {evaluation.id && (
          <p className="print-ref">Reference: {evaluation.id}</p>
        )}
      </footer>
    </div>
  );
}

export default PrintableEvaluationForm;
