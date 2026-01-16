import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import PropertyCard from './components/PropertyCard';
import AddPropertyModal from './components/AddPropertyModal';
import CsvImportModal from './components/CsvImportModal';
import { Plus, RefreshCw, Loader2, Upload } from 'lucide-react';

function App() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      
      if (data.success) {
        setProperties(data.properties);
      } else {
        throw new Error(data.message || 'Failed to fetch properties');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to Agent Database. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-panel p-6 rounded-xl">
            <h3 className="text-muted text-sm uppercase tracking-wider mb-2">Active Knowledge Base</h3>
            <p className="text-3xl font-bold">{properties.length} Listings</p>
          </div>
          <div className="glass-panel p-6 rounded-xl">
             <h3 className="text-muted text-sm uppercase tracking-wider mb-2">Last Sync</h3>
             <p className="text-xl font-medium text-blue-400 flex items-center gap-2">
               <span className="status-dot"></span> Real-time
             </p>
          </div>
           {/* Placeholder for future metric */}
           <div className="glass-panel p-6 rounded-xl opacity-50">
             <h3 className="text-muted text-sm uppercase tracking-wider mb-2">Total Inquiries</h3>
             <p className="text-3xl font-bold">--</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Properties</h2>
          <div className="flex gap-3">
            <button 
              onClick={fetchProperties} 
              className="p-2 glass-panel rounded-lg hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} /> Add Listing
            </button>
            <button 
              onClick={() => setIsImportOpen(true)}
              className="p-2 glass-panel rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
              title="Import CSV"
            >
              <Upload size={20} />
            </button>
          </div>
        </div>

        <AddPropertyModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchProperties}
        />

        <CsvImportModal 
          isOpen={isImportOpen} 
          onClose={() => setIsImportOpen(false)}
          onSuccess={fetchProperties}
        />

        {/* Content Area */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={48} className="animate-spin text-blue-500" />
          </div>
        ) : error ? (
           <div className="glass-panel p-8 text-center rounded-xl border-red-900/50 bg-red-900/10">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={fetchProperties} className="btn-primary">Try Again</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(prop => (
              <PropertyCard key={prop.property_id} property={prop} />
            ))}
            
            {/* Empty State if no properties */}
            {properties.length === 0 && (
              <div className="col-span-full glass-panel p-12 text-center rounded-xl">
                 <div className="mx-auto bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <Home size={32} className="text-slate-500" />
                 </div>
                 <h3 className="text-xl font-bold mb-2">No Properties Found</h3>
                 <p className="text-muted mb-6">Your agent doesn't know any properties yet.</p>
                 <button onClick={() => setIsModalOpen(true)} className="btn-primary">Add Your First Listing</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
