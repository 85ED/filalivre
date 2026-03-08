import { useEffect, useRef, useState } from 'react';

interface SnakeGameProps {
  onClose?: () => void;
}

export function SnakeGame({ onClose }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gameStateRef = useRef({
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15 },
    direction: { x: 1, y: 0 },
    score: 0,
    gameOver: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = 20;
    const tileCount = canvas.width / gridSize;

    const gameLoop = setInterval(() => {
      const game = gameStateRef.current;
      if (game.gameOver) return;

      // Move snake
      const head = { ...game.snake[0] };
      head.x += game.direction.x;
      head.y += game.direction.y;

      // Check collisions
      if (
        head.x < 0 ||
        head.x >= tileCount ||
        head.y < 0 ||
        head.y >= tileCount ||
        game.snake.some((seg) => seg.x === head.x && seg.y === head.y)
      ) {
        game.gameOver = true;
        setGameOver(true);
        return;
      }

      game.snake.unshift(head);

      // Check food collision
      if (head.x === game.food.x && head.y === game.food.y) {
        game.score += 10;
        setScore(game.score);
        game.food = {
          x: Math.floor(Math.random() * tileCount),
          y: Math.floor(Math.random() * tileCount),
        };
      } else {
        game.snake.pop();
      }

      // Draw
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvas.width, i * gridSize);
        ctx.stroke();
      }

      // Draw snake
      ctx.fillStyle = '#10b981';
      game.snake.forEach((seg, i) => {
        ctx.fillRect(
          seg.x * gridSize + 1,
          seg.y * gridSize + 1,
          gridSize - 2,
          gridSize - 2
        );
        if (i === 0) {
          ctx.fillStyle = '#059669';
        }
      });

      // Draw food
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(
        game.food.x * gridSize + gridSize / 2,
        game.food.y * gridSize + gridSize / 2,
        gridSize / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }, 100);

    const handleKeyPress = (e: KeyboardEvent) => {
      const game = gameStateRef.current;
      const key = e.key.toLowerCase();

      if (key === 'arrowup' || key === 'w') {
        if (game.direction.y === 0) game.direction = { x: 0, y: -1 };
      } else if (key === 'arrowdown' || key === 's') {
        if (game.direction.y === 0) game.direction = { x: 0, y: 1 };
      } else if (key === 'arrowleft' || key === 'a') {
        if (game.direction.x === 0) game.direction = { x: -1, y: 0 };
      } else if (key === 'arrowright' || key === 'd') {
        if (game.direction.x === 0) game.direction = { x: 1, y: 0 };
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      clearInterval(gameLoop);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-between items-center w-full">
        <div className="text-lg font-bold text-neutral-900">Score: {score}</div>
        {gameOver && (
          <div className="text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded">
            Game Over! Score: {score}
          </div>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="border-2 border-neutral-300 rounded-lg shadow-md"
      />
      <p className="text-xs text-neutral-500">
        Use setas do teclado para se mover
      </p>
    </div>
  );
}

export function TetrisGame({ onClose }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const gameStateRef = useRef({
    board: Array(20).fill(null).map(() => Array(10).fill(0)),
    score: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawBoard = () => {
      const cellSize = 40;
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i <= 20; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
      }

      // Score
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Em desenvolvimento', 60, 200);
      ctx.fillText('Score: ' + score, 40, 230);
    };

    drawBoard();
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-lg font-bold text-neutral-900">Score: {score}</div>
      <canvas
        ref={canvasRef}
        width={400}
        height={800}
        className="border-2 border-neutral-300 rounded-lg shadow-md bg-white"
      />
      <p className="text-xs text-neutral-500 text-center">
        Tetris - Em desenvolvimento<br />
        Jogue Snake enquanto isso!
      </p>
    </div>
  );
}
