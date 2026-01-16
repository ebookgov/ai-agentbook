import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';

export default function CsvImportModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('upload'); // upload, preview, uploading, success
  const [parsedData, setParsedData] = useState([]);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Error parsing CSV. Please check formatting.');
          console.error(results.errors);
          return;
        }
        
        // Transform data to match backend schema
        const transformed = results.data.map(row => ({
          name: row.Address || row.Name || 'Unknown Property',
          price: Number((row.Price || '0').replace(/[^0-9.]/g, '')),
          price_formatted: row.Price || '$0',
          acreage: Number(row.Acres || 0),
          location: {
            city: row.City || 'Unknown',
            state: row.State || 'AZ',
            address: row.Address || ''
          },
          features: {
            bedrooms: Number(row.Beds || 0),
            bathrooms: Number(row.Baths || 0),
            sqft: Number(row.SqFt || 0),
            structure: 'Single Family'
          },
          highlights: row.Description ? [row.Description] : [],
          status: 'active'
        }));

        setParsedData(transformed);
        setStep('preview');
        setError(null);
      },
      error: (err) => {
        setError('Failed to read file.');
        console.error(err);
      }
    });
  };

  const handleImport = async () => {
    setStep('uploading');
    try {
      const res = await fetch('/api/properties/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: parsedData })
      });
      
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Import failed');
      
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
        setStep('upload');
        setParsedData([]);
      }, 2000);

    } catch (err) {
      setError(err.message);
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl glass-panel rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-xl font-bold">Import Properties (CSV)</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {step === 'upload' && (
            <div 
              className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-blue-500 hover:bg-blue-500/10 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-slate-800 p-4 rounded-full inline-block mb-4 group-hover:scale-110 transition-transform">
                <Upload size={32} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Click to Upload CSV</h3>
              <p className="text-sm text-muted">Headers: Address, City, State, Price, Beds, Baths</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              {error && <p className="text-red-400 mt-4 flex items-center justify-center gap-2"><AlertCircle size={16}/> {error}</p>}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Previewing {parsedData.length} Properties</h3>
                <button onClick={() => setStep('upload')} className="text-sm text-slate-400 hover:text-white">Change File</button>
              </div>
              
              <div className="bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700 max-h-[300px] overflow-y-auto mb-6">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="p-3">Address</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Beds/Baths</th>
                      <th className="p-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="p-3 font-medium">{row.name}</td>
                        <td className="p-3 text-emerald-400">{row.price_formatted}</td>
                        <td className="p-3">{row.features.bedrooms}/{row.features.bathrooms}</td>
                        <td className="p-3 text-slate-400 text-xs">Ready</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && <p className="text-red-400 mb-4">{error}</p>}

              <div className="flex justify-end gap-3">
                <button onClick={() => setStep('upload')} className="px-4 py-2 hover:bg-white/5 rounded-lg">Cancel</button>
                <button onClick={handleImport} className="btn-primary flex items-center gap-2">
                  <Check size={18} /> Import {parsedData.length} Listings
                </button>
              </div>
            </div>
          )}

          {step === 'uploading' && (
            <div className="text-center py-12">
              <Loader2 size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Syncing with AI Knowledge Base...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-12">
              <div className="bg-emerald-500/20 text-emerald-400 p-4 rounded-full inline-block mb-4">
                <Check size={48} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Import Complete!</h3>
              <p className="text-muted">Your properties are now live.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
