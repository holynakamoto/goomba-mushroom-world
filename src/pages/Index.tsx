import { GameCanvas } from '@/components/GameCanvas';

const Index = () => {
  return (
    <div className="min-h-screen bg-mario-sky p-4">
      <div className="text-center mb-6">
        <h1 className="text-6xl font-bold pixel-font text-mario-white mb-2">
          SUPER MARIO BROS
        </h1>
        <h2 className="text-3xl pixel-font text-mario-yellow mb-4">
          World 1-1: Goomba & Mushroom Edition
        </h2>
        <p className="text-lg pixel-font text-mario-white">
          A recreation of the classic first level with enhanced Goomba and Mushroom gameplay!
        </p>
      </div>
      
      <div className="flex justify-center">
        <GameCanvas />
      </div>
    </div>
  );
};

export default Index;
