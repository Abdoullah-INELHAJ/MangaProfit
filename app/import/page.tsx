'use client';

import React, { useState, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { exportToCSV, parseCSVData, generateSlug, cleanTitle, parseVolumeRange } from '../../lib/dbAdapter';
import { Upload, Download, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Manga } from '../../lib/defaultData';

export default function ImportExportPage() {
  const { mangas, updateMangaList, resetDatabase } = useData();
  
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Drag Over
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Process XLSX / XLS Workbook using SheetJS
  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Impossible de lire les données du fichier.");
        
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Parse worksheet raw data
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawJson.length < 2) {
          throw new Error("Fichier vide ou structure incorrecte.");
        }

        // Find header row or default to row 1 (skipping row 0 instructions)
        let headerRowIdx = 1;
        for (let i = 0; i < Math.min(rawJson.length, 5); i++) {
          const row = rawJson[i];
          if (row && row.some((cell: any) => String(cell).includes('Manga') || String(cell).includes('Titre') || String(cell).includes('Achat Max'))) {
            headerRowIdx = i;
            break;
          }
        }

        const mangaRows = rawJson.slice(headerRowIdx + 1);
        const importedMangas: Manga[] = [];
        let index = 1;

        for (const row of mangaRows) {
          if (!row || row.length === 0) continue;
          
          const displayTitle = String(row[0] || '').trim();
          if (!displayTitle || displayTitle.toLowerCase().includes('manga') || displayTitle.toLowerCase().includes('prix max d')) {
            continue;
          }

          const condition = String(row[1] || 'TBE').trim();
          const retailPrice = parseFloat(String(row[2]).replace(',', '.') || '0') || 0;
          const maxBuyPrice = parseFloat(String(row[3]).replace(',', '.') || '0') || 0;
          const minSellPrice = parseFloat(String(row[4]).replace(',', '.') || '0') || 0;
          const maxSellPrice = parseFloat(String(row[5]).replace(',', '.') || '0') || 0;
          const notes = row[7] ? String(row[7]).trim() : '';

          // Extraction using the helper functions
          const titre = cleanTitle(displayTitle);
          const { debut, fin } = parseVolumeRange(displayTitle, '');

          const hypeScore = Math.floor(Math.random() * 40) + 50;
          const popularity = hypeScore >= 80 ? 'Très forte' : hypeScore >= 65 ? 'Forte' : hypeScore >= 50 ? 'Moyenne' : 'Faible';

          importedMangas.push({
            id: generateSlug(displayTitle),
            titre,
            nom_arc_collection: displayTitle,
            volume_debut: debut,
            volume_fin: fin,
            état: condition,
            prix_moyen_neuf: retailPrice,
            prix_achat_max: maxBuyPrice,
            prix_vente_min: minSellPrice,
            prix_vente_max: maxSellPrice,
            notes,
            hypeScore,
            popularity,
            tags: [],
            isFavorite: false
          });
          index++;
        }

        if (importedMangas.length === 0) {
          throw new Error("Aucune ligne de mangas valide n'a pu être extraite.");
        }

        updateMangaList(importedMangas);
        setStatus({
          type: 'success',
          message: `${importedMangas.length} mangas importés avec succès depuis le fichier Excel !`
        });
      } catch (err: any) {
        console.error(err);
        setStatus({
          type: 'error',
          message: `Erreur d'import Excel : ${err.message || 'Structure de colonnes invalide.'}`
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Process CSV File (Text parsing)
  const processCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("Fichier CSV vide.");
        
        const parsed = parseCSVData(text);
        if (parsed.length === 0) {
          throw new Error("Aucun manga n'a pu être extrait. Vérifiez que le séparateur est bien un point-virgule (;) ou une virgule (,) et que la structure est respectée.");
        }
        
        updateMangaList(parsed);
        setStatus({
          type: 'success',
          message: `${parsed.length} mangas importés avec succès depuis le fichier CSV !`
        });
      } catch (err: any) {
        setStatus({
          type: 'error',
          message: `Erreur d'import CSV : ${err.message}`
        });
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // File selection routing (Excel vs CSV)
  const handleFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'xlsx' || extension === 'xls') {
      processExcelFile(file);
    } else if (extension === 'csv') {
      processCSVFile(file);
    } else {
      setStatus({
        type: 'error',
        message: "Format de fichier non pris en charge. Veuillez fournir un fichier Excel (.xlsx) ou CSV (.csv)."
      });
    }
  };

  // Handle Drop event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Input selection
  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Export database to CSV download
  const handleExport = () => {
    try {
      const csvStr = exportToCSV(mangas);
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvStr], { type: 'text/csv;charset=utf-8;' }); // UTF-8 BOM for Excel
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `mangaprofit_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatus({ type: 'success', message: 'Catalogue exporté avec succès en CSV ! (Séparateur point-virgule)' });
    } catch (e) {
      setStatus({ type: 'error', message: 'Erreur lors de la génération de l\'export.' });
    }
  };

  const handleReset = () => {
    if (confirm("Voulez-vous réinitialiser le catalogue avec les données d'origine ? Toutes vos modifications locales, favoris et tags seront effacés.")) {
      resetDatabase();
      setStatus({ type: 'success', message: 'La base de données a été réinitialisée avec succès !' });
    }
  };

  return (
    <div>
      <section style={{ padding: '20px 0 32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Gestion des <span style={{ color: 'var(--accent-neon)' }}>Données</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Importez ou exportez votre catalogue pour maintenir vos prix d&apos;achat et de revente à jour sans toucher au code.
        </p>
      </section>

      <div style={layoutGrid}>
        {/* Left Column: File Importer Drag & Drop */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={sectionTitleStyle}>Importer un Catalogue</h3>
            <p style={sectionSubStyle}>
              Glissez-déposez votre fichier de suivi Excel (.xlsx) ou CSV (.csv séparateur point-virgule) pour mettre à jour les prix instantanément.
            </p>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={dragActive ? { ...dropZoneStyle, borderColor: 'var(--accent-neon)', backgroundColor: 'rgba(255, 62, 62, 0.04)' } : dropZoneStyle}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelectChange}
                style={{ display: 'none' }}
              />
              <Upload size={38} style={{ color: dragActive ? 'var(--accent-neon)' : 'var(--text-secondary)', marginBottom: '12px' }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>Cliquez ou glissez-déposez le fichier ici</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>Excel (.xlsx) ou CSV point-virgule (;) uniquement</p>
            </div>

            {/* Status alerts */}
            {status.type && (
              <div style={status.type === 'success' ? successAlertStyle : errorAlertStyle}>
                {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{status.message}</span>
              </div>
            )}
          </div>

          {/* Database Reset Action */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={sectionTitleStyle}>Réinitialiser la Base</h3>
            <p style={sectionSubStyle}>
              Remettez à zéro les modifications locales et rechargez la liste de mangas depuis le fichier Excel initial &quot;manga_price_tracker.xlsx&quot;.
            </p>
            <button onClick={handleReset} style={resetBtnStyle}>
              <RefreshCw size={16} />
              <span>Réinitialiser aux valeurs par défaut</span>
            </button>
          </div>
        </div>

        {/* Right Column: Schema description and Export tools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={sectionTitleStyle}>Exporter le Catalogue</h3>
            <p style={sectionSubStyle}>
              Téléchargez votre base de données active contenant tous vos ajustements de prix, verdicts calculés et notes dans un fichier CSV.
            </p>
            <button onClick={handleExport} className="btn-neon" style={{ width: '100%', justifyContent: 'center' }}>
              <Download size={16} />
              <span>Télécharger l&apos;export CSV (.csv)</span>
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={sectionTitleStyle}>Structure du Fichier</h3>
            <p style={sectionSubStyle}>
              Pour être accepté lors de l&apos;import, votre fichier Excel ou CSV doit respecter les colonnes suivantes :
            </p>
            
            <div style={schemaContainerStyle}>
              <div style={schemaRowStyle}>
                <span style={colNumStyle}>1</span>
                <strong>Manga / Titre</strong>
                <span style={colDescStyle}>Nom du manga + tranches de tomes (ex: One Piece 1 a 10)</span>
              </div>
              <div style={schemaRowStyle}>
                <span style={colNumStyle}>2</span>
                <strong>État</strong>
                <span style={colDescStyle}>Niveau d&apos;état recommandé (ex: TBE, BE, Correct)</span>
              </div>
              <div style={schemaRowStyle}>
                <span style={colNumStyle}>3</span>
                <strong>Prix neuf moyen</strong>
                <span style={colDescStyle}>Prix neuf indicatif en librairie (€)</span>
              </div>
              <div style={schemaRowStyle}>
                <span style={colNumStyle}>4</span>
                <strong>Prix Vinted Achat Max</strong>
                <span style={colDescStyle}>Prix maximum recommandé à l&apos;achat sur Vinted (€)</span>
              </div>
              <div style={schemaRowStyle}>
                <span style={colNumStyle}>5</span>
                <strong>Prix Vinted Revente min</strong>
                <span style={colDescStyle}>Prix minimum conseillé pour la revente (€)</span>
              </div>
              <div style={schemaRowStyle}>
                <span style={colNumStyle}>6</span>
                <strong>Prix Vinted Revente Max</strong>
                <span style={colDescStyle}>Prix maximum conseillé pour la revente (€)</span>
              </div>
              <div style={schemaRowStyle}>
                <span style={colNumStyle}>8</span>
                <strong>Notes / lien</strong>
                <span style={colDescStyle}>Notes personnelles, stratégies ou liens de recherche</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline styles for data management layout
const layoutGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '24px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: '4px',
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  marginBottom: '20px',
  lineHeight: 1.4,
};

const dropZoneStyle: React.CSSProperties = {
  border: '2px dashed var(--border-medium)',
  borderRadius: '12px',
  padding: '40px 20px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
  backgroundColor: 'var(--bg-secondary)',
};

const successAlertStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  backgroundColor: 'rgba(0, 230, 118, 0.08)',
  color: 'var(--success)',
  border: '1px solid rgba(0, 230, 118, 0.2)',
  padding: '12px 16px',
  borderRadius: '8px',
  marginTop: '20px',
};

const errorAlertStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  backgroundColor: 'rgba(255, 23, 68, 0.08)',
  color: 'var(--danger)',
  border: '1px solid rgba(255, 23, 68, 0.2)',
  padding: '12px 16px',
  borderRadius: '8px',
  marginTop: '20px',
};

const resetBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  backgroundColor: 'rgba(255, 62, 62, 0.05)',
  border: '1px solid var(--border-accent)',
  color: 'var(--accent-neon)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
};

const schemaContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const schemaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '0.85rem',
  padding: '8px',
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: '6px',
  border: '1px solid var(--border-light)',
};

const colNumStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.7rem',
  fontWeight: 700,
};

const colDescStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  marginLeft: 'auto',
  fontSize: '0.75rem',
  textAlign: 'right',
  maxWidth: '220px',
};
