import { GameCanvas } from '@/components/GameCanvas';

const Index = () => {
  return (
    <div className="min-h-screen bg-mario-sky p-4">
      <div className="text-center mb-6">
        <h1 className="text-6xl font-bold pixel-font text-mario-white mb-2">
          SUPER MARIO BROS
        </h1>
        <h2 className="text-3xl pixel-font text-mario-yellow mb-4">
          World 1-1, 1-2 & 1-3: Complete Adventure Edition
        </h2>
        <p className="text-lg pixel-font text-mario-white">
          Experience all three classic levels: Overworld, Underground, and Tree-tops!
        </p>
      </div>
      
      <div className="flex justify-center">
        <GameCanvas />
      </div>
    </div>
  );
};

export default Index;
