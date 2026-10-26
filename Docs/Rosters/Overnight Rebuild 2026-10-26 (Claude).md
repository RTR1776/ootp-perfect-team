# Overnight roster rebuild, 2026-10-26 (Claude)

**60 current tournament events rebuilt; 59 saved** as "Claude pick 2026-10-26 review" (each replaced that event's earlier Claude pick on /build).
- 52 changed cards; 8 kept their 26 (re-slotted at most).
- Daily Iron Cap's rebuild matched its 10-25 pick (1136), which stays.
- The other current events kept their saved picks: no card change, no rule break, and their environments price as before.

## Why
1. **The model review** (Docs/Model Review 2026-10-25.md):
   - Era team weights for 1977–2009 events.
   - pBABIP fix for 1946–93.
   - The per-position glove repricing reverted.
2. **Banks (102, #86621) sold.** He was on 5 saved rosters: All-Star Hardware Slots, Open Slots, Wide Open, Sunday Open Main Event, Sunday Open Slots.
3. **Cards gained since each roster was saved** (`--changes`):
   - Ernie Clement, Livan and Orlando Hernández, Hank Gowdy, Greinke and others.
   - Ohtani is gone from Time Travelers Slots: he isn't in the 10-25 collection.
4. **Two builder bugs found and fixed tonight:**
   - **Position floors.** A start seeded from the saved roster kept lineup spots under L.J.'s floors (SS 85, CF 90, 2B 85, RF 75). That had been true since seeding was added on 09-30. 18 events had one: Otto Lopez at 2B (79), Oneil Cruz at SS (65), Eric Davis VAR in CF (64), Joe Dugan VAR at 2B (70)…
     - All fixed. The floors are now also the default in `current-rosters` (they used to be a flag to remember).
     - Daily Live Iron keeps Tovar (81) at SS: no Live Iron card of his rates 85+ there.
   - **Starter stamina.** A starter short of the era's floor (Dank's Robertson 64 vs 70, Dreamland's Orwoll 56 vs 80) now swaps automatically with the cheapest pen arm that clears it.
   - **Shape.** Tuesday Dead Silver Walking is always built to L.J.'s 4 SP / 5 RP.
5. **Negro Leagues Slots** needs the card-year override (1800–2026) for the builder's set check; built and saved as 1213.

## Adames (#83584): checked after the batch
The batch passed Banks as sold but not Adames as bought (he came after collection 306). Re-checked with him owned (`--bought 83584`):
- Card Fit starts him in no current event at +1 run or more.
- A full Iron & Friends build (772) leaves him out. It scores 27.9 runs, within noise of tonight's pick (whose own climb reached 27.8), so #1173 stays.
- The 10-25 call (start him at 2B vs RHP) came before the model review cut the glove weight in 1994–2009 events. The build with him in the pool plays Phillips (2B 130) and Seager (SS 119) instead.

**Until a new collection upload:** collection 306 still lists Banks and lacks Adames. Pass `--sold 86621 --bought 83584` with any card-change run. /build also reads ownership from the newest upload, so it still offers Banks.

## League (not saved in the app)
Without Banks, Seager plays SS against both hands: vs LHP lineup +63.6 → +53.8, about −0.4 W a week. **Keep De Vries: he is now the backup SS.** Park stays 1987 Yankee. League Plan 2026-10-25 §12.

## What changed, by event (IN | OUT, card value)
- Daily All-Star Hardware Slots: IN Juan Soto 102, Willie Hernandez 102, Orlando Hernandez 78, Bob Gibson 44, Felipe Lopez 68, Vic Power 76 | OUT Ernie Banks 102, Harvey Haddix 101, Bob Walk 73, Russ Ortiz 68, Andy Van Slyke 77, Brice Turang 55
- Daily Bronze 1910-59: IN Tetelo Vargas 63, Eggie Dallard 67, Joe DiMaggio 64, Connie Day 50 | OUT Stan Hack 46, Bob Bowman 55, Billy Martin 48, Mule Haas 69
- Daily Bronze Only Cap: IN Ernie Clement 64, Livan Hernandez 68 | OUT Jefferson Rojas 66, Hal Woodeshick 66
- Daily Bronze Only Curiosities: IN Ed Bailey 69, Ernie Clement 64, Livan Hernandez 68, Barry Larkin 64 | OUT Frank Grube 60, Khalil Greene 62, Honus Wagner 68, Roy Halladay 61
- Daily Bronze OOTP Era: IN Felipe Lopez 68, Ernie Clement 64, Shane Victorino 69 | OUT Byron Buxton 64, Bill Hall 59, Shawn Green 59
- Daily Bronze PTCS 3 Replay Slots: IN Ernie Clement 64, Gabby Hartnett 66, Livan Hernandez 68 | OUT Jefferson Rojas 66, Tony Pena Sr. 62, Satchel Paige 68
- Daily Dank: IN Austin Jackson 48, Nico Hoerner 48 | OUT Wally Backman 47, Billy Martin 48
- Daily Diamond: IN Brian Roberts 87, Eric Davis 85, Jered Weaver 89, Al Leiter 90, Branch Russell 83 | OUT Kaelen Culpepper 89, Mike Greenwell 99, Ryan Sloan 98, Tommy John 92, JJ Wetherholt 96
- Daily Diamond 1990 Onward: IN Carlos Pena 89, Devin Williams 99, Chris Taylor 59 | OUT Jacoby Ellsbury 98, Jake McGee 99, Colt Emerson 98
- Daily Diamond Cap: IN Babe Ruth 97, Mike Marshall 57, Walt French 44 | OUT Claude Grier 99, John Bale 59, Charlie Eden 40
- Daily Diamond Up to 1969: IN Dewey Creacy 94, Luther Farrell 87, Dizzy Trout 97, Luke Appling 92 | OUT Ernie Banks 83, Larry Jackson 92, Sam Jones 92, Ken Boyer 96
- Daily Early Bronze: IN Ernie Clement 64, Shane Victorino 69, Luther Farrell 66, Livan Hernandez 68 | OUT Jefferson Rojas 66, Eddie Plank 66, Bill Lee 65, Joc Pederson 68
- Daily Early Years Cap: IN Ed Rile 102 | OUT Cy Young 102
- Daily Gold Cap: IN Joe Beggs 89, John Bale 59, Alfredo Amezaga 44 | OUT Bob Feller 88, Mike Marshall 57, Rickey Henderson 46
- Daily Gold Slots: IN Pedro Alvarez 81, Ernie Clement 64, Jered Weaver 89, Orlando Hernandez 78, Billy Southworth 68 | OUT Carlos Pena 89, CC Sabathia 82, Jordan Montgomery 77, Jack Tobin 61, Bill Buckner 64
- Daily Golden Heart: IN Sam Streeter 85 | OUT Jim Kaat 87
- Daily Iron & Friends OOTP Era Slots: IN Andruw Jones 57, Braxton Fulford 57 | OUT Ethan Salas 59, Norris Hopper 53
- Daily Iron Dreamland: IN Javier Baez 49, Dwayne Hosey 49, James McDonald 55 | OUT Freddy Galvis 58, Ken Berry 55, Griffin Canning 55
- Daily Iron Lunch: IN Joe Krakauskas 57, Broderick Perkins 57 | OUT Carlos Beltran 58, Tin Can Kincannon 45
- Daily Iron Strikes Back: IN Rick Wilkins 57, Shawn Green 59, Braxton Fulford 57, Sammy Sosa 43, Bullet Campbell 56, Pat Perry 58, Tom Seaver 56 | OUT Joe Torre 57, Freddy Galvis 58, Jake Rogers 57, Ken Berry 55, Patricio Scantlebury 56, Max Scherzer 57, Bob Gibson 44
- Daily Late 1900s: IN Pedro Guerrero 92, Jose Oquendo 73 | OUT Lonnie Smith 98, Carlos Baerga 86
- Daily Late Bronze: IN Ernie Clement 64, Hank Blalock 68, Shane Victorino 69, Livan Hernandez 68 | OUT Ben Zobrist 69, Ozzie Smith 59, Eric Byrnes 67, Tanner McDougal 66
- Daily Late Silver: IN Ernie Clement 64, Chris Sabo 66, Orlando Hernandez 78, Mickey Lolich 69, Mike Greenwell 77 | OUT Allen Craig 74, Brandon Phillips 64, Jakie May 72, Alex Claudio 70, Jose Oquendo 73
- Daily Live Bronze: IN Masyn Winn 66, Derek Hill 66, Ben Williamson 51 | OUT Gunnar Henderson 66, Tyrone Taylor 62, David Hamilton 64
- Daily Live Diamond: IN Masyn Winn 66, Michael Harris II 89, Byron Buxton 91, Miguel Rojas 74 | OUT Oneil Cruz 98, Ceddanne Rafaela 83, Ben Rice 99, CJ Abrams 82
- Daily Live Gold: IN Masyn Winn 66, Miguel Rojas 74 | OUT Geraldo Perdomo 84, Otto Lopez 83
- Daily Live Iron: IN Luis Lara 58, Cameron Cauley 55 | OUT Justin Crawford 59, Alika Williams 51
- Daily Live Open: IN Michael Harris II 89, Miguel Rojas 74 | OUT Oneil Cruz 98, Garrett Mitchell 97
- Daily Live Plus: IN Max Clark 98, Luis Pena 90 | OUT Aidan Miller 98, Colt Emerson 98
- Daily Live Silver: IN Masyn Winn 66, Konnor Griffin 77, Parker Meadows 75, Miguel Rojas 74 | OUT Sam Antonacci 74, A.J. Ewing 73, Nick Gonzales 78, Zach Neto 75
- Daily Low Bronze Only: IN Ernie Clement 64, Ian Desmond 64, Jim Bouton 64, Jonas Gaines 64 | OUT Khalil Greene 62, Roy Halladay 61, Paul Assenmacher 62, Julio Cruz 62
- Daily Open Slots: IN Mike Piazza 101, George Brett 103, Corey Seager 103, Deion Sanders 69, Ryan Braun 74, Cy Young 99, Catfish Hunter 92, Joe Beggs 89, Orlando Hernandez 78, Livan Hernandez 68, Shawn Green 59 | OUT Thurman Munson 97, Pedro Alvarez 81, Arjun Nimmala 94, Ernie Banks 102, Chris Sabo 66, Cy Young 102, Orel Hershiser 102, Jordan Montgomery 77, Jacob deGrom 79, James McDonald 55, Tom Brown 66
- Daily PTCS 2 Iron Replay: IN Alfredo Amezaga 44 | OUT Freddy Galvis 58
- Daily Roaring Silvers: IN Hank Gowdy 79, Bobby Lowe 78, Kid Nichols 79, Luther Farrell 66, Marcelino Guerra 73, Bill Dahlen 77, Sanford Jackson 73 | OUT Bill Keister 72, Jakie May 72, Cool Papa Bell 68, Paul Easterling 74, Jack Tobin 61, Halley Harding 71, Tex Erwin 77
- Daily Silver Slots: IN Ernie Clement 64, Orlando Hernandez 78, Mickey Lolich 69, Chris Taylor 59, Bob Bowman 55 | OUT Steve Pearce 69, Brandon Phillips 64, Alex Claudio 70, John Bale 59, Milt Thompson 58
- Daily Silver Snapshots: IN Ed Bailey 69, Billy Southworth 68, Colby Rasmus 77, Allen Craig 74, Julio Teheran 79, Julio Lugo 73 | OUT Mark Grudzielanek 65, Steve Finley 79, Andruw Jones 79, Chad Billingsley 78, Bill Hall 59, Cal McVey 47
- Daily Wide Open: IN Willie Mays 98, Brandon Wood 101 | OUT Ernie Banks 102, Arjun Nimmala 94
- Dr. Dynastic's Daily Time Travelers Slots: IN Pete Alonso 97, Yoshinobu Yamamoto 100, Tarik Skubal 100, Reid Detmers 99 | OUT Miguel Vargas 94, Shohei Ohtani 100, Dylan Cease 100, Blake Snell 99
- Friday Danksville: IN Cal McVey 47, Nate Robertson 45, Nico Hoerner 48 | OUT Buddy Rosar 49, Mark Trumbo 49, Mark Langston 48
- Friday Night Live Slots: IN Kevin McGonigle 99, David Peterson 68, Derek Hill 66, Abraham Toro 58, Miguel Rojas 74 | OUT Javier Sanoja 73, Logan Webb 95, Hao-Yu Lee 58, Daylen Lile 61, Kody Clemens 67
- Friday Nightmare Cap: IN Shane Victorino 69, Orlando Hernandez 78, Armando Rios 66 | OUT Billy Southworth 68, Ellis Burks 66, Bill Ricks 79
- Monday Up And At Them Bronze: IN Tim McCarver 68, Ernie Clement 64, Gabby Hartnett 66, Jim Bouton 64, Livan Hernandez 68, Larry Sherry 66, Brandon Beachy 67, Pat Patterson 67 | OUT Jimmy Crooks 68, Mark Grudzielanek 65, Jefferson Rojas 66, Tony Pena Sr. 62, Christy Mathewson 65, Corey Kluber 64, Cool Papa Bell 68, Red Lucas 68
- Monday Wonky Historical Slots: IN Jack Burdock 87, Dizzy Trout 97, Pee Wee Butts 65, Billy Southworth 68 | OUT Frankie Frisch 94, Bob Feller 88, Tom Brown 66, Joe Dugan 65
- Saturday Bronze Cap: IN Ernie Clement 64, Vladimir Guerrero 48, George Sisler 48, Sammy Sosa 43, Livan Hernandez 68, Mike Marshall 57, Tin Can Kincannon 45 | OUT Sam Bankhead 49, Eric Byrnes 67, Javier Baez 49, Chuck Finley 60, Caden Scarborough 64, Jerry Augustine 42, Jay Johnstone 42
- Saturday Iron Warriors: IN Rick Wilkins 57, Shawn Green 59, Javier Baez 49, Braxton Fulford 57, Sammy Sosa 43, Bullet Campbell 56, Tom Seaver 56 | OUT Joe Torre 57, Freddy Galvis 58, Jake Rogers 57, Carlos Beltran 58, Ken Berry 55, Max Scherzer 57, Patricio Scantlebury 56
- Saturday Negro Leagues Slots: IN Biz Mackey 74, Hilton Smith 101, Tetelo Vargas 63, Pepper Bassett 57 | OUT Satchel Paige 100, Otto Briggs 62, Judy Johnson 79, Sam Bankhead 49
- Sunday Open Main Event: IN Willie Mays 98, Brandon Wood 101 | OUT Ernie Banks 102, Arjun Nimmala 94
- Sunday Open Slots: IN Corey Seager 103, Bret Saberhagen 102 | OUT Ernie Banks 102, Eddie Plank 102
- Thursday Splendid Silver Only Spectacular: IN Orlando Hernandez 78, Andy McGaffigan 73, Alex Claudio 70 | OUT Jakie May 72, Brian Anderson 72, Zack Wheeler 79
- Tuesday Dead Silver Walking: IN Hank Gowdy 79, Emmet Heidrick 79, Ted Easterly 58, Dave Brain 68 | OUT Wilbert Robinson 77, Charlie Hickman 74, Dick Hoblitzel 73, Spud Johnson 60
- Tuesday Live: IN Nico Hoerner 75, Sal Stewart 85, Byron Buxton 91, Miguel Rojas 74 | OUT Otto Lopez 83, Kevin McGonigle 99, Miguel Vargas 94, Oneil Cruz 98
- Tuesday Sporer's Sandlot: IN Kal Daniels 82, Orlando Hernandez 78, Ricky Romero 82, Jose Oquendo 73 | OUT Placido Polanco 77, J.A. Happ 87, Raisel Iglesias 80, Tony Phillips 88
- 60 events rebuilt tonight; 8 kept the same 26 cards (re-slotted at most)
