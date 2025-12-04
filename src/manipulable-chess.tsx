import { span } from "./DragSpec";
import { Manipulable, translate } from "./manipulable";

export const WHITE_PIECES = "♔♕♖♗♘♙"; // K Q R B N P
export const BLACK_PIECES = "♚♛♜♝♞♟"; // K Q R B N P

// Invisible ID encoding: encodes a numeric id into zero-width characters
// Uses U+2060 WORD JOINER as a marker, followed by a base-4 sequence
// of zero-width characters: 0->U+200B (ZWSP), 1->U+200C (ZWNJ), 2->U+200D (ZWJ), 3->U+2060 (WJ).
const ZW_CHARS = ["\u200B", "\u200C", "\u200D", "\u2060"];
const ID_MARK = "\u2060"; // marker to indicate flavored piece

export namespace Chess {
  export type State = {
    board: string[][];
    player: "white" | "black";
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const TILE_SIZE = 50;
    return (
      <g>
        {state.board.map((row, i) =>
          row.map((_, j) => (
            <rect
              x={j * TILE_SIZE}
              y={i * TILE_SIZE}
              width={TILE_SIZE}
              height={TILE_SIZE}
              stroke="gray"
              strokeWidth={1}
              fill={(j + i) % 2 ? "#eee" : "#000"}
            />
          ))
        )}
        {state.board.map((row, i) =>
          row.map((tile, j) => {
            if (!tile) return null;
            const glyph = stripFlavor(tile);
            const pieceIsWhite = isWhite(glyph);
            const canDrag = state.player === (pieceIsWhite ? "white" : "black");
            return (
              <g
                id={tile}
                transform={translate(j * TILE_SIZE, i * TILE_SIZE)}
                data-z-index={1}
                data-on-drag={
                  canDrag
                    ? drag(() => {
                        const moves = generateLegalMoves(state.board, {
                          row: i,
                          col: j,
                        });
                        const targetStates = moves.map((mv) => {
                          const next = structuredClone(state);
                          const moving = next.board[mv.from.row][mv.from.col];
                          next.board[mv.from.row][mv.from.col] = "";
                          const placed = mv.promotion
                            ? withGlyph(moving, mv.promotion)
                            : moving;
                          next.board[mv.to.row][mv.to.col] = placed;
                          next.player =
                            next.player === "white" ? "black" : "white";
                          return next;
                        });
                        return span(targetStates);
                      })
                    : undefined
                }
              >
                <rect
                  x={4}
                  y={4}
                  width={TILE_SIZE - 8}
                  height={TILE_SIZE - 8}
                  rx={8}
                  fill={pieceIsWhite ? "#000" : "#fff"}
                  fillOpacity={pieceIsWhite ? 0.35 : 0.65}
                />
                <text
                  x={TILE_SIZE / 2}
                  y={TILE_SIZE / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={28}
                  fill={pieceIsWhite ? "#fff" : "#000"}
                >
                  {stripFlavor(tile)}
                </text>
              </g>
            );
          })
        )}
        <text x={4} y={-8} fontSize={14} fill="#222">
          {state.player === "white" ? "White to move" : "Black to move"}
        </text>
      </g>
    );
  };

  export const initialState: State = {
    board: flavorInitialBoard([
      ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"], // 8
      ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"], // 7
      ["", "", "", "", "", "", "", ""], // 6
      ["", "", "", "", "", "", "", ""], // 5
      ["", "", "", "", "", "", "", ""], // 4
      ["", "", "", "", "", "", "", ""], // 3
      ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"], // 2
      ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"], // 1
    ]),
    player: "white",
  };

  export type Move = {
    from: { row: number; col: number };
    to: { row: number; col: number };
    capture: boolean;
    promotion?: string; // resulting piece unicode if promotion occurs
  };

  export function flavorPiece(pieceChar: string, id: number): string {
    if (!pieceChar) return pieceChar;
    // encode id in base-4 zero-width digits after a marker
    const digits: string[] = [];
    let n = Math.max(0, Math.floor(id));
    if (n === 0) digits.push(ZW_CHARS[0]);
    while (n > 0) {
      digits.push(ZW_CHARS[n % 4]);
      n = Math.floor(n / 4);
    }
    return pieceChar + ID_MARK + digits.join("");
  }

  export function stripFlavor(pieceChar: string): string {
    if (!pieceChar) return pieceChar;
    // remove marker and zero-width digits, keep visible glyph
    return pieceChar.replace(/[\u2060\u200B\u200C\u200D]/g, "");
  }

  export function extractPieceId(pieceChar: string): number | null {
    if (!pieceChar) return null;
    const idx = pieceChar.indexOf(ID_MARK);
    if (idx === -1) return null;
    let n = 0;
    for (let i = idx + 1; i < pieceChar.length; i++) {
      const ch = pieceChar[i];
      const digit = ZW_CHARS.indexOf(ch);
      if (digit === -1) continue;
      n = n * 4 + digit;
    }
    return n;
  }

  // Replace the visible glyph of a flavored piece while keeping its ID flavoring
  export function withGlyph(pieceChar: string, newGlyph: string): string {
    const id = extractPieceId(pieceChar);
    return id == null ? newGlyph : flavorPiece(newGlyph, id);
  }

  // Create a uniquely flavored initial board
  function flavorInitialBoard(board: string[][]): string[][] {
    let id = 1;
    return board.map((row) =>
      row.map((ch) => (ch ? flavorPiece(ch, id++) : ch))
    );
  }

  const isWhite = (p: string) => WHITE_PIECES.includes(p);
  const isBlack = (p: string) => BLACK_PIECES.includes(p);

  const isKing = (p: string) => p === "♔" || p === "♚";
  const isQueen = (p: string) => p === "♕" || p === "♛";
  const isRook = (p: string) => p === "♖" || p === "♜";
  const isBishop = (p: string) => p === "♗" || p === "♝";
  const isKnight = (p: string) => p === "♘" || p === "♞";
  const isPawn = (p: string) => p === "♙" || p === "♟";

  const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

  // Generate pseudo-legal moves (ignores check, castling, en-passant)
  export function generateLegalMoves(
    board: string[][],
    from: { row: number; col: number }
  ): Move[] {
    const moves: Move[] = [];
    const piece = stripFlavor(board[from.row][from.col]);
    if (!piece) return moves;
    const color = isWhite(piece) ? "white" : isBlack(piece) ? "black" : null;
    if (!color) return moves;
    // use unicode-based piece classification
    const forwardDir = color === "white" ? -1 : 1; // white moves toward row 0

    const addMove = (r: number, c: number) => {
      if (!inBounds(r, c)) return;
      const target = stripFlavor(board[r][c]);
      const capture =
        !!target &&
        ((color === "white" && isBlack(target)) ||
          (color === "black" && isWhite(target)));
      if (target && !capture) return; // own piece blocking
      const move: Move = { from, to: { row: r, col: c }, capture };
      // Pawn promotion detection
      if (isPawn(piece) && (r === 0 || r === 7)) {
        move.promotion = color === "white" ? "♕" : "♛"; // default promote to queen
      }
      moves.push(move);
    };

    if (isPawn(piece)) {
      const startRow = color === "white" ? 6 : 1;
      const oneForwardR = from.row + forwardDir;
      // forward move
      if (
        inBounds(oneForwardR, from.col) &&
        stripFlavor(board[oneForwardR][from.col]) === ""
      ) {
        addMove(oneForwardR, from.col);
        const twoForwardR = from.row + 2 * forwardDir;
        if (
          from.row === startRow &&
          stripFlavor(board[twoForwardR][from.col]) === ""
        ) {
          addMove(twoForwardR, from.col);
        }
      }
      // captures
      for (const dc of [-1, 1]) {
        const r = from.row + forwardDir;
        const c = from.col + dc;
        if (!inBounds(r, c)) continue;
        const target = stripFlavor(board[r][c]);
        if (
          target &&
          ((color === "white" && isBlack(target)) ||
            (color === "black" && isWhite(target)))
        ) {
          addMove(r, c);
        }
      }
      return moves;
    }

    if (isKnight(piece)) {
      const deltas = [
        [2, 1],
        [2, -1],
        [-2, 1],
        [-2, -1],
        [1, 2],
        [1, -2],
        [-1, 2],
        [-1, -2],
      ];
      for (const [dr, dc] of deltas) addMove(from.row + dr, from.col + dc);
      return moves;
    }

    const rayDirections: Record<string, [number, number][]> = {
      R: [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ],
      B: [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ],
      Q: [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ],
      K: [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ],
    };

    if (isKing(piece)) {
      for (const [dr, dc] of rayDirections.K)
        addMove(from.row + dr, from.col + dc);
      return moves;
    }

    if (isRook(piece) || isBishop(piece) || isQueen(piece)) {
      const dirs = isQueen(piece)
        ? rayDirections.Q
        : isRook(piece)
        ? rayDirections.R
        : rayDirections.B;
      for (const [dr, dc] of dirs) {
        let r = from.row + dr;
        let c = from.col + dc;
        while (inBounds(r, c)) {
          const target = stripFlavor(board[r][c]);
          if (target === "") {
            addMove(r, c);
          } else {
            // capture if enemy then break
            if (
              (color === "white" && isBlack(target)) ||
              (color === "black" && isWhite(target))
            )
              addMove(r, c);
            break;
          }
          r += dr;
          c += dc;
        }
      }
      return moves;
    }

    return moves; // unknown piece type
  }
}
