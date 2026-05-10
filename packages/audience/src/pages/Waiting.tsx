export function Waiting({ name }: { name: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-twilio-red border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h2 className="text-xl font-bold">You're in, {name}!</h2>
        <p className="text-gray-400 mt-2">Waiting for the next interaction...</p>
        <p className="text-gray-500 text-sm mt-4">Keep your phone handy</p>
      </div>
    </div>
  );
}
