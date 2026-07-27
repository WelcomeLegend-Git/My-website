/** Public by design: invite links can open a Ludo room without website login. */
export const LudoPage = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-900 text-slate-200">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-400/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3h8l2 4-2 4H8L6 7l2-4zm0 10h8l2 4-2 4H8l-2-4 2-4zm-5-5h2m14 0h2M12 1v2m0 18v2" />
          </svg>
        </div>
      </div>
      <h1 className="text-4xl font-bold text-amber-300 mb-2">Ludo Arena</h1>
      <p className="text-xl text-slate-400">Coming Soon</p>
      <p className="text-sm text-slate-500 mt-4 max-w-md text-center">
        We are currently developing this feature. Check back later to play solo or with friends!
      </p>
    </div>
  );
};
