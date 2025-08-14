import { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'mario' | 'goomba' | 'mushroom' | 'coin' | 'block' | 'pipe' | 'ground' | 'oneup';
  active: boolean;
  vx?: number;
  vy?: number;
  grounded?: boolean;
  collected?: boolean;
  direction?: number;
  big?: boolean;
}

interface GameState {
  mario: GameObject;
  objects: GameObject[];
  camera: { x: number; y: number };
  score: number;
  lives: number;
  coins: number;
  gameRunning: boolean;
  gameWon: boolean;
  gameOver: boolean;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MARIO_SPEED = 3;
const GOOMBA_SPEED = 1;

export const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  
  const [gameState, setGameState] = useState<GameState>({
    mario: {
      x: 50,
      y: 300,
      width: 16,
      height: 16,
      type: 'mario',
      active: true,
      vx: 0,
      vy: 0,
      grounded: false,
      big: false
    },
    objects: [],
    camera: { x: 0, y: 0 },
    score: 0,
    lives: 3,
    coins: 0,
    gameRunning: false,
    gameWon: false,
    gameOver: false
  });

  // Initialize level
  const initializeLevel = useCallback(() => {
    const levelObjects: GameObject[] = [
      // Ground blocks
      ...Array.from({ length: 50 }, (_, i) => ({
        x: i * 32,
        y: 368,
        width: 32,
        height: 32,
        type: 'ground' as const,
        active: true
      })),
      
      // Question blocks with mushrooms
      { x: 256, y: 272, width: 32, height: 32, type: 'block', active: true },
      { x: 352, y: 272, width: 32, height: 32, type: 'block', active: true },
      { x: 768, y: 272, width: 32, height: 32, type: 'block', active: true },
      
      // Pipes
      { x: 448, y: 304, width: 64, height: 64, type: 'pipe', active: true },
      { x: 608, y: 272, width: 64, height: 96, type: 'pipe', active: true },
      { x: 928, y: 240, width: 64, height: 128, type: 'pipe', active: true },
      
      // Goombas
      { x: 300, y: 320, width: 16, height: 16, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 400, y: 320, width: 16, height: 16, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 500, y: 320, width: 16, height: 16, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 700, y: 320, width: 16, height: 16, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 850, y: 320, width: 16, height: 16, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      
      // Hidden 1UP mushroom trigger
      { x: 736, y: 272, width: 32, height: 32, type: 'block', active: true },
      
      // Coins
      { x: 320, y: 240, width: 16, height: 16, type: 'coin', active: true },
      { x: 480, y: 240, width: 16, height: 16, type: 'coin', active: true },
      { x: 640, y: 200, width: 16, height: 16, type: 'coin', active: true },
    ];

    setGameState(prev => ({
      ...prev,
      objects: levelObjects,
      mario: {
        ...prev.mario,
        x: 50,
        y: 300,
        vx: 0,
        vy: 0,
        grounded: false,
        big: false
      },
      camera: { x: 0, y: 0 },
      score: 0,
      coins: 0,
      gameRunning: true,
      gameWon: false,
      gameOver: false
    }));
  }, []);

  // Draw functions
  const drawMario = (ctx: CanvasRenderingContext2D, mario: GameObject, camera: { x: number; y: number }) => {
    const screenX = mario.x - camera.x;
    const screenY = mario.y - camera.y;
    
    // Mario body
    ctx.fillStyle = mario.big ? '#FF6B6B' : '#4ECDC4';
    ctx.fillRect(screenX, screenY, mario.width, mario.height);
    
    // Mario hat
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(screenX + 4, screenY - 4, 8, 8);
    
    // Simple face
    ctx.fillStyle = '#F4D03F';
    ctx.fillRect(screenX + 2, screenY + 4, 12, 8);
  };

  const drawGoomba = (ctx: CanvasRenderingContext2D, goomba: GameObject, camera: { x: number; y: number }) => {
    const screenX = goomba.x - camera.x;
    const screenY = goomba.y - camera.y;
    
    // Goomba body
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(screenX, screenY, goomba.width, goomba.height);
    
    // Eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(screenX + 3, screenY + 3, 2, 2);
    ctx.fillRect(screenX + 11, screenY + 3, 2, 2);
    
    // Angry eyebrows
    ctx.fillRect(screenX + 2, screenY + 1, 4, 1);
    ctx.fillRect(screenX + 10, screenY + 1, 4, 1);
  };

  const drawMushroom = (ctx: CanvasRenderingContext2D, mushroom: GameObject, camera: { x: number; y: number }) => {
    const screenX = mushroom.x - camera.x;
    const screenY = mushroom.y - camera.y;
    
    // Mushroom cap
    ctx.fillStyle = mushroom.type === 'oneup' ? '#2ECC71' : '#E74C3C';
    ctx.fillRect(screenX, screenY, mushroom.width, 12);
    
    // Mushroom stem
    ctx.fillStyle = '#F4D03F';
    ctx.fillRect(screenX + 4, screenY + 8, 8, 8);
    
    // Spots
    ctx.fillStyle = '#FFFFFF';
    if (mushroom.type === 'oneup') {
      // 1UP pattern
      ctx.fillRect(screenX + 6, screenY + 3, 4, 6);
    } else {
      // Regular mushroom spots
      ctx.fillRect(screenX + 3, screenY + 2, 3, 3);
      ctx.fillRect(screenX + 10, screenY + 2, 3, 3);
    }
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: GameObject, camera: { x: number; y: number }) => {
    const screenX = obj.x - camera.x;
    const screenY = obj.y - camera.y;
    
    switch (obj.type) {
      case 'ground':
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        break;
        
      case 'block':
        ctx.fillStyle = '#F39C12';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = '#E67E22';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        // Question mark
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', screenX + 16, screenY + 22);
        break;
        
      case 'pipe':
        ctx.fillStyle = '#27AE60';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = '#229954';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        // Pipe opening
        ctx.fillStyle = '#1B4F72';
        ctx.fillRect(screenX + 8, screenY, 48, 16);
        break;
        
      case 'coin':
        ctx.fillStyle = '#F1C40F';
        ctx.beginPath();
        ctx.arc(screenX + 8, screenY + 8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F39C12';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
        
      case 'mushroom':
      case 'oneup':
        drawMushroom(ctx, obj, camera);
        break;
    }
  };

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.gameRunning) return;

    setGameState(prevState => {
      const newState = { ...prevState };
      const mario = { ...newState.mario };
      const objects = [...newState.objects];

      // Handle input
      if (keysRef.current.has('ArrowLeft')) {
        mario.vx = -MARIO_SPEED;
      } else if (keysRef.current.has('ArrowRight')) {
        mario.vx = MARIO_SPEED;
      } else {
        mario.vx *= 0.8; // Friction
      }

      if (keysRef.current.has('Space') && mario.grounded) {
        mario.vy = JUMP_FORCE;
        mario.grounded = false;
      }

      // Apply gravity
      mario.vy += GRAVITY;
      if (mario.vy > 15) mario.vy = 15; // Terminal velocity

      // Update Mario position
      mario.x += mario.vx;
      mario.y += mario.vy;

      // Ground collision
      if (mario.y + mario.height >= 368) {
        mario.y = 368 - mario.height;
        mario.vy = 0;
        mario.grounded = true;
      }

      // Update Goombas
      objects.forEach(obj => {
        if (obj.type === 'goomba' && obj.active) {
          obj.x += obj.vx || 0;
          
          // Reverse direction at edges or when hitting pipes
          const nextX = obj.x + (obj.vx || 0);
          const hitsPipe = objects.some(other => 
            other.type === 'pipe' && 
            nextX < other.x + other.width && 
            nextX + obj.width > other.x &&
            obj.y < other.y + other.height && 
            obj.y + obj.height > other.y
          );
          
          if (hitsPipe || obj.x <= 0 || obj.x >= 1500) {
            obj.vx = -(obj.vx || 0);
          }
        }
      });

      // Collision detection
      objects.forEach((obj, index) => {
        if (!obj.active) return;

        const collision = mario.x < obj.x + obj.width &&
                         mario.x + mario.width > obj.x &&
                         mario.y < obj.y + obj.height &&
                         mario.y + mario.height > obj.y;

        if (collision) {
          switch (obj.type) {
            case 'goomba':
              if (mario.vy > 0 && mario.y < obj.y) {
                // Mario stomps Goomba
                obj.active = false;
                mario.vy = JUMP_FORCE / 2;
                newState.score += 100;
              } else {
                // Mario hits Goomba
                if (mario.big) {
                  mario.big = false;
                  mario.height = 16;
                } else {
                  newState.lives--;
                  if (newState.lives <= 0) {
                    newState.gameOver = true;
                    newState.gameRunning = false;
                  } else {
                    // Reset Mario position
                    mario.x = 50;
                    mario.y = 300;
                    mario.vx = 0;
                    mario.vy = 0;
                  }
                }
              }
              break;

            case 'coin':
              obj.active = false;
              newState.coins++;
              newState.score += 200;
              if (newState.coins >= 100) {
                newState.lives++;
                newState.coins = 0;
              }
              break;

            case 'block':
              if (mario.vy > 0 && mario.y < obj.y) {
                // Mario hits block from below
                obj.active = false;
                // Spawn mushroom
                const mushroom: GameObject = {
                  x: obj.x,
                  y: obj.y - 16,
                  width: 16,
                  height: 16,
                  type: Math.random() < 0.1 ? 'oneup' : 'mushroom',
                  active: true,
                  vx: 1
                };
                objects.push(mushroom);
                mario.vy = 0;
              }
              break;

            case 'mushroom':
              obj.active = false;
              mario.big = true;
              mario.height = 24;
              newState.score += 1000;
              break;

            case 'oneup':
              obj.active = false;
              newState.lives++;
              newState.score += 1000;
              break;
          }
        }
      });

      // Update mushrooms
      objects.forEach(obj => {
        if ((obj.type === 'mushroom' || obj.type === 'oneup') && obj.active) {
          obj.x += obj.vx || 0;
          obj.vy = (obj.vy || 0) + GRAVITY;
          obj.y += obj.vy || 0;
          
          // Ground collision for mushrooms
          if (obj.y + obj.height >= 368) {
            obj.y = 368 - obj.height;
            obj.vy = 0;
          }
        }
      });

      // Update camera to follow Mario
      newState.camera.x = Math.max(0, mario.x - CANVAS_WIDTH / 2);

      // Check win condition (reach end of level)
      if (mario.x > 1400) {
        newState.gameWon = true;
        newState.gameRunning = false;
      }

      newState.mario = mario;
      newState.objects = objects;

      return newState;
    });
  }, [gameState.gameRunning]);

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#5DADE2';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw objects
    gameState.objects.forEach(obj => {
      if (obj.active) {
        drawObject(ctx, obj, gameState.camera);
      }
    });

    // Draw Mario
    drawMario(ctx, gameState.mario, gameState.camera);

    // Draw UI
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${gameState.score}`, 10, 25);
    ctx.fillText(`Lives: ${gameState.lives}`, 10, 45);
    ctx.fillText(`Coins: ${gameState.coins}`, 10, 65);

    if (gameState.gameWon) {
      ctx.fillStyle = '#F1C40F';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOU WIN!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    if (gameState.gameOver) {
      ctx.fillStyle = '#E74C3C';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
  }, [gameState]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      gameLoop();
      render();
      animationRef.current = requestAnimationFrame(animate);
    };

    if (gameState.gameRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameLoop, render, gameState.gameRunning]);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault();
      keysRef.current.add(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = () => {
    initializeLevel();
  };

  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      gameRunning: false,
      gameWon: false,
      gameOver: false,
      lives: 3,
      score: 0,
      coins: 0
    }));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Card className="p-4 bg-game-ui-bg border-game-ui-border">
        <div className="flex gap-4 mb-4">
          <Button 
            onClick={startGame} 
            className="btn-8bit"
            disabled={gameState.gameRunning}
          >
            Start Game
          </Button>
          <Button 
            onClick={resetGame} 
            className="btn-8bit bg-mario-blue"
          >
            Reset
          </Button>
        </div>
        
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas bg-mario-sky"
        />
        
        <div className="mt-4 text-center pixel-font text-mario-white">
          <p>Use Arrow Keys to move, Space to jump</p>
          <p>Stomp Goombas, collect Mushrooms and Coins!</p>
          {!gameState.gameRunning && !gameState.gameWon && !gameState.gameOver && (
            <p className="mt-2 text-mario-yellow">Press Start Game to begin!</p>
          )}
        </div>
      </Card>
    </div>
  );
};