# Character Encoding

Vestaboard uses a proprietary numeric character-code system, not ASCII. Understanding this is essential when working with board matrices.

## Code Ranges

| Code | Meaning |
|---|---|
| `0` | Blank cell |
| `1–26` | Letters A–Z |
| `27–35` | Digits 1–9 |
| `36` | Digit 0 |
| `37–62` | Punctuation and special symbols |
| `63–71` | Colour fill tiles |

## Supported Printable Characters

```
ABCDEFGHIJKLMNOPQRSTUVWXYZ
0123456789
! @ # $ ( ) - + & = ; : ' " % , . / ? °
(space)
```

Lowercase letters are **not supported** — text is always uppercased before encoding.

## Special Character Codes

| Char | Code | | Char | Code |
|---|---|---|---|---|
| `!` | 37 | | `=` | 48 |
| `@` | 38 | | `;` | 49 |
| `#` | 39 | | `:` | 50 |
| `$` | 40 | | `'` | 52 |
| `(` | 41 | | `"` | 53 |
| `)` | 42 | | `%` | 54 |
| `-` | 44 | | `,` | 55 |
| `+` | 46 | | `.` | 56 |
| `&` | 47 | | `/` | 59 |
| | | | `?` | 60 |
| | | | `°` | 62 |

## Colour Fill Codes

| Code | Colour |
|---|---|
| `63` | Red `#FF4136` |
| `64` | Orange `#FF851B` |
| `65` | Yellow `#FFDC00` |
| `66` | Green `#2ECC40` |
| `67` | Blue `#0074D9` |
| `68` | Violet `#B10DC9` |
| `69` | White `#FFFFFF` |
| `70` | Black `#000000` |
| `71` | Default flap colour |

Colour tiles fill an entire cell with a solid colour and render no character glyph.

## Board Dimensions

| Model | Rows | Cols | Total cells |
|---|---|---|---|
| Flagship | 6 | 22 | 132 |
| Note | 3 | 15 | 45 |

## Matrix Format

A board state is a 2-D array of integer codes:

```ts
type BoardMatrix = number[][];
// e.g. for a 2×3 board:
[[1, 2, 3], [27, 28, 0]]  // "ABC" / "01 "
```

## Utility Functions (`lib/board-utils.ts`)

| Function | Description |
|---|---|
| `charToCode(ch)` | Single character → Vestaboard code |
| `codeToChar(code)` | Vestaboard code → printable character |
| `textToMatrix(text, rows, cols)` | Multi-line text string → board matrix |
| `matrixToPlainText(matrix)` | Board matrix → plain text string |
| `emptyMatrix(rows?, cols?)` | Returns a blank matrix |
| `cloneMatrix(matrix)` | Deep-copies a matrix |
| `fillMatrix(code, rows?, cols?)` | Fills entire matrix with one code |
| `normalizeMatrixSize(matrix)` | Crops/pads to exact board dimensions |
| `matrixHasContent(matrix)` | Returns true if any cell is non-zero |

## Validation (`lib/message-validation.ts`)

`validateMessageText(text, boardModel?)` checks:
1. Text is non-empty after trimming
2. Length ≤ `rows × cols` for the given board model
3. Every character (after uppercasing) is in the allowed set

`validateMatrix(matrix)` checks:
1. Is a non-empty 2-D array
2. Every value is an integer in `[0, 71]`
