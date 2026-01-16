import React, { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';

export default function AddPropertyModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    city: '',
    state: 'AZ',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    acreage: '',
    description: ''
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Format payload for backend
      const payload = {
        property_id: `AZ-MAN-${Date.now().toString().slice(-6)}`, // Simple unique ID
        name: formData.name,
        price: Number(formData.price),
        price_formatted: `$${Number(formData.price).toLocaleString()}`,
        acreage: Number(formData.acreage) || 0,
        location: {
          city: formData.city,
          state: formData.state,
          distance: 'Unknown distance' 
        },
        features: {
          structure: 'Single Family',
          bedrooms: Number(formData.bedrooms),
          bathrooms: Number(formData.bathrooms),
          sqft: Number(formData.sqft)
        },
        highlights: [formData.description || 'Newly added property']
      };

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to create property');

      onSuccess();
      onClose();
      // Reset form
      setFormData({
        name: '', price: '', city: '', state: 'AZ',
        bedrooms: '', bathrooms: '', sqft: '', acreage: '', description: ''
      });

    } catch (err) {
      console.error(err);
      alert('Error adding property. Check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-panel rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-xl font-bold">Add New Property</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Property Name</label>
            <input 
              required
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Sunset Ridge Cabin"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Price ($)</label>
              <input 
                required type="number"
                name="price" value={formData.price} onChange={handleChange}
                placeholder="450000"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">City</label>
              <input 
                required
                name="city" value={formData.city} onChange={handleChange}
                placeholder="Sedona"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Bedrooms</label>
              <input 
                type="number"
                name="bedrooms" value={formData.bedrooms} onChange={handleChange}
                placeholder="3"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2"
              />
            </div>
            <div>
               <label className="block text-sm font-medium mb-1 text-slate-300">Bathrooms</label>
               <input 
                 type="number"
                 name="bathrooms" value={formData.bathrooms} onChange={handleChange}
                 placeholder="2"
                 className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2"
               />
             </div>
             <div>
               <label className="block text-sm font-medium mb-1 text-slate-300">Sq Ft</label>
               <input 
                 type="number"
                 name="sqft" value={formData.sqft} onChange={handleChange}
                 placeholder="2100"
                 className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2"
               />
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Key Feature / Highlight (Optional)</label>
            <input 
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="e.g. Backs to National Forest"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 hover:bg-white/5 rounded-lg text-sm font-medium">Cancel</button>
            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary min-w-[100px] flex justify-center"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
