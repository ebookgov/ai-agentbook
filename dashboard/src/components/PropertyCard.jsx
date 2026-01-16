import React from 'react';
import { MapPin, Bed, Bath, Move, Home, ExternalLink } from 'lucide-react';

export default function PropertyCard({ property }) {
  const { 
    name, 
    price_formatted, 
    price, 
    location, 
    features, 
    acreage, 
    property_id 
  } = property;

  const displayPrice = price_formatted || (price ? `$${price.toLocaleString()}` : 'Price on Request');
  
  return (
    <div className="glass-card rounded-xl overflow-hidden group">
      {/* Mock Image Area - In real app, this would be property.image */}
      <div className="h-48 bg-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10" />
        <img 
          src={`https://source.unsplash.com/800x600/?house,modern,${property_id}`} 
          alt={name} 
          className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
          }}
        />
        <div className="absolute top-4 right-4 z-20">
          <span className="px-3 py-1 glass-panel rounded-full text-xs font-medium flex items-center">
            <span className="status-dot"></span> Live
          </span>
        </div>
        <div className="absolute bottom-4 left-4 z-20">
          <h3 className="text-lg font-bold truncate pr-4">{name}</h3>
          <p className="text-sm text-slate-300 flex items-center gap-1">
            <MapPin size={14} /> {location?.city || 'Unknown'}, {location?.state || 'AZ'}
          </p>
        </div>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1">List Price</p>
            <p className="text-2xl font-bold text-blue-400">{displayPrice}</p>
          </div>
          <div className="text-right">
             <p className="text-xs text-muted uppercase tracking-wider mb-1">ID</p>
             <p className="text-sm font-mono text-slate-400">{property_id}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-2 bg-slate-800/50 rounded-lg">
            <Bed size={18} className="mx-auto mb-1 text-slate-400" />
            <span className="text-sm font-medium">{features?.bedrooms || '-'}</span>
            <span className="text-xs text-muted block">Beds</span>
          </div>
          <div className="text-center p-2 bg-slate-800/50 rounded-lg">
            <Bath size={18} className="mx-auto mb-1 text-slate-400" />
            <span className="text-sm font-medium">{features?.bathrooms || '-'}</span>
            <span className="text-xs text-muted block">Baths</span>
          </div>
          <div className="text-center p-2 bg-slate-800/50 rounded-lg">
            <Move size={18} className="mx-auto mb-1 text-slate-400" />
            <span className="text-sm font-medium">{features?.sqft || acreage || '-'}</span>
            <span className="text-xs text-muted block">{features?.sqft ? 'Sq Ft' : 'Acres'}</span>
          </div>
        </div>

        <button className="w-full py-2 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors text-sm flex items-center justify-center gap-2">
          View Details <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}
