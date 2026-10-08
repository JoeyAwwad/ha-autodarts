# Caller lines

Every line the classic game screen's caller can say. With `voice_path` set, the card plays
`<voice_path><line>.mp3` (for example `/local/darts/voice/180.mp3`) and speaks any line that has
no recording with the browser's voice, so recordings can be added a few at a time.

Record short and loud, with no silence at the start or end. To record many lines in one take,
read them with a pause between them and split the take with
[`tools/split-caller.mjs`](tools/split-caller.mjs) (it needs ffmpeg):

```sh
node contrib/classic-game-screen/tools/split-caller.mjs numbers.wav voice              # score_0 ... score_180
node contrib/classic-game-screen/tools/split-caller.mjs take2.wav voice --from 100 --to 180
node contrib/classic-game-screen/tools/split-caller.mjs calls.wav voice --lines calls   # the calls below, in order
node contrib/classic-game-screen/tools/split-caller.mjs names.wav voice --lines name_robin,name_sam
```

The tool refuses to write when the number of spoken parts differs from the number of lines,
so no number ends up under the wrong name. A longer pause between lines (`--gap 0.5`) or a
different noise floor (`--noise -30` in a noisy room, `-45` in a quiet one) fixes most takes.

## Scores

`score_0` ... `score_180`: every visit score in caller style ("one hundred and forty"). They
are also used after "you require" and after "checkout".

## Calls

Read in this order for `--lines calls`.

| Line | Said |
| --- | --- |
| `game_on` | Game on! (also at the start of a sudden death) |
| `180` | One hundred and eighty! |
| `no_score` | No score |
| `bust` | Bust! |
| `you_require` | You require (then the score) |
| `checkout` | Checkout (then the score, for finishes of 100 or more) |
| `game_shot` | Game shot! |
| `game_shot_leg` | Game shot, and the leg! |
| `game_shot_match` | Game shot, and the match! |
| `up_next` | Up next (then the name, in the games that are not X01) |
| `bounce_out` | Bounce out! |
| `three_in_a_bed` | Three in a bed! |
| `doubles_closed` | Doubles closed! |
| `triples_closed` | Triples closed! |
| `bullseye` | Bullseye! (the card's games, and sudden death) |
| `ladder` | Up the ladder! (Snakes & Ladders) |
| `snake` | Snake! (Snakes & Ladders) |
| `goal` | Goal! (Football) |
| `killer` | Killer! (Killer Night) |
| `shanghai` | Shanghai! (Party Shanghai) |
| `black` | The black! (Snooker) |
| `tower_down` | Tower down! (Tower Takedown) |

## Player names

`name_<name>`: the name in lower case with spaces and other signs as `_`, for example
`name_robin` or `name_mary_ann`. The caller says the name before "you require", after
"game shot" and after "up next".

## Moment pictures

The same keys work for the `moments` option (a picture slammed in over the screen): `180`,
`ton`, `ton40`, `bull`, `t20`, `bust`, `miss`, `bounce_out`, `three_in_a_bed`, `game_shot`,
the game moments `ladder`, `snake`, `goal`, `killer`, `shanghai`, `black`, `tower_down`,
`bullseye`, and a win picture per game, `<game>_win` (for example `derby_win`,
`snakes_win`), shown instead of `game_shot` when there is one.
