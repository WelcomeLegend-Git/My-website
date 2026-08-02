import { AnatomyApp } from "../../features/anatomy/components/AnatomyApp";
import { Link } from "react-router-dom";

export const AnatomyPage = () => {
  return (
    <div className="w-full h-screen bg-black relative">
      {/* Back button overlay */}
      <Link 
        to="/" 
        className="absolute top-4 left-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </Link>
      
      <div className="w-full h-full">
        <AnatomyApp />
      </div>
    </div>
  );
};
