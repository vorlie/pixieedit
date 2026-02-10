import { useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

const Library = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNotice, setShowNotice] = useState(() => !localStorage.getItem('pixie_notice_dismissed'));
  
  // Fetch images from Dexie
  const images = useLiveQuery(() => db.images.orderBy('timestamp').reverse().toArray());

  const generateThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.7);
      };
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const thumbnailBlob = await generateThumbnail(file);
      
      const newImageId = await db.images.add({
        originalBlob: file,
        thumbnailBlob: thumbnailBlob,
        edits: {
          brightness: 100,
          contrast: 100,
          saturation: 100,
          warmth: 0,
          sharpness: 0,
        },
        timestamp: Date.now(),
      });

      navigate('/editor', { state: { imageId: newImageId } });
    }
  };

  const dismissNotice = () => {
    localStorage.setItem('pixie_notice_dismissed', 'true');
    setShowNotice(false);
  };

  return (
    <div className="flex h-screen bg-surface text-on-surface overflow-hidden relative">
      {/* PC Side Navigation */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-outline/10 p-4 gap-2">
        <h1 className="px-4 py-6 text-2xl font-sans font-medium tracking-tight">PixieEdit</h1>
        
        <button className="flex items-center gap-4 px-4 py-3 bg-primary-container text-on-primary-container rounded-full font-medium transition-all text-sm">
          <span className="material-symbols-rounded">image</span>
          <span>Photos</span>
        </button>

        <div className="mt-auto p-4">
             <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-4 rounded-2xl font-medium shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
                <span className="material-symbols-rounded">add</span>
                <span>Upload photo</span>
            </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-6 py-4 flex items-center justify-between lg:hidden border-b border-outline/5">
          <h1 className="text-2xl font-sans font-medium tracking-tight">Photos</h1>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex px-8 py-6 items-center justify-between border-b border-outline/5">
           <h1 className="text-2xl font-sans font-medium tracking-tight opacity-50">All Photos</h1>
        </header>
        
        <main className="flex-1 px-4 lg:px-8 py-6 grid grid-cols-3 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-8 gap-1 overflow-y-auto content-start">
          {/* Add Photo Button (Mobile) */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="lg:hidden aspect-square bg-surface-variant flex flex-col items-center justify-center cursor-pointer hover:bg-opacity-80 transition-all gap-2 rounded-sm"
          >
            <span className="material-symbols-rounded text-3xl text-on-surface-variant">add_photo_alternate</span>
            <span className="text-xs font-medium text-on-surface-variant">Add photo</span>
          </div>

          <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
          />

          {/* Real images from IndexedDB */}
          {images?.map((img) => (
            <div 
                key={img.id} 
                className="aspect-square bg-surface-variant cursor-pointer transition-all hover:scale-[0.98] active:scale-95 group relative overflow-hidden rounded-sm lg:rounded-md"
            >
              <img 
                onClick={() => navigate('/editor', { state: { imageId: img.id } })}
                src={URL.createObjectURL(img.thumbnailBlob)} 
                alt="Captured" 
                className="w-full h-full object-cover"
              />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (img.id) db.images.delete(img.id);
                }}
                className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-error transition-all"
              >
                <span className="material-symbols-rounded text-sm">delete</span>
              </button>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 pointer-events-none transition-colors" />
            </div>
          ))}

          {/* Placeholders if empty */}
          {(!images || images.length === 0) && [...Array(24)].map((_, i) => (
            <div key={i} className="aspect-square bg-surface-variant opacity-40 hover:opacity-60 cursor-pointer transition-all rounded-sm lg:rounded-md" />
          ))}
        </main>
      </div>

      {/* First-run Transparency Notice */}
      {showNotice && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismissNotice} />
          <div className="relative bg-surface p-8 rounded-[32px] max-w-sm w-full shadow-2xl border border-outline/10 flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-3xl">verified_user</span>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-sans font-medium tracking-tight">Everything stays local</h2>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Your photos and edits are stored directly in your browser's local database. We never upload your data, ensuring total privacy.
              </p>
              <p className="text-on-surface-variant/60 text-[11px] leading-relaxed mt-2">
                Note: This may use additional device storage space.
              </p>
            </div>
            <button 
              onClick={dismissNotice}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-medium hover:brightness-110 active:scale-95 transition-all shadow-lg"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
