# New cards 2026-11-21 (Claude): rosters rebuilt on collection 422

## What changed

- **Collection 422 (11-21) vs 420 (11-20):**
  - **11 cards in:** Matsui DH 100 (back), Kemp CF 99, Gio Gonzalez SP 94, Vaughan SS 92, Paxton SP 88, Ryu SP 86, Dennis Martinez SP 85, Donlin LF 83, Musial 1B 78, Cruz RF 68, Quintana SP 59.
  - **3 out:** Grzenda RP 98, Logan Henderson SP 94, Báez 2B 78 (82926).
  - **Variant added:** Pagliarulo.
- **Bigger than this upload:** 113 cards are new to at least one event's saved roster. Many rosters were saved before uploads 418 and 420 (Story, Alcantara, Liriano, McCarthy, Thatcher, Keuchel, Morton and others).
- **No trades outstanding:** Kemp, Gio Gonzalez, Keuchel, Morton and Alcantara are all in 422. No `--sold` / `--bought` is needed.

## Build

```
current-rosters --changes --tag 2026-11-21-new --out ../Inbox/rosters --jobs 6
```

- **Screen:** `--changes --list` found 57 events at a +1-run trigger and 53 at the default +3; 21 events stay as saved.
- **Result:** 53 of 53 built and legal.
  - Every roster check passed: staff, starter stamina, C/SS and other backups.
  - Staff shapes match each field's top quarter.
- **Files:**
  - manifest `Inbox/rosters/current-2026-11-21-new.tsv`;
  - logs `Inbox/rosters/<id>.txt`;
  - seeds `<id>-seed.txt`.
- **Gain:** today's objective minus the saved roster's score on today's collection and model (the same seed). Total +922.5 weighted runs across 53 events.
- **Soto check (Open events):** Soto left the Wide Open and Sunday Open Main Event rosters. The model platoons Granderson vs RHP (49.1 against Soto's 40.7) with Kemp vs LHP (53.9 against Soto's 39.8).
- **Cap events:**
  - Early Years Cap (+1.8) didn't take Donlin or Steel Arm Davis: their screens of +13.4 and +12.3 assume no cap.
  - Diamond Cap stays at 4 SP / 5 RP / 18 bats, the same shape as its saved roster.

## Saved (11-22, on L.J.'s "Yes, save all 53")

- **Backup first:** `Docs/Archive/saved-rosters-2026-11-22.json.gz` (114 rosters).
- **Saved:** all 53 as "Claude pick 2026-11-21 new", rosters 2262–2314, using `roster-save.ts --replace`.
- **Checked in the database:**
  - 53 rosters, one per event;
  - 26 distinct cards each;
  - no event holds two Claude picks.
- **Replaced:** 55 older Claude picks, every one of them a Claude pick. Silver & Friends Slots (9100190) had three, and all three were replaced. The backup holds them all.

## Per event (gain order)

| Id | Event | Saved → new | Gain | In | Out |
|---|---|---|---|---|---|
| 9100199 | Daily Diamond 1990 Onward | 590.4 → 659.9 | +69.5 | Trevor Story SS 88, Matt Kemp CF 99, Seiya Suzuki RF 95, Sandy Alcantara SP 99, Gio Gonzalez SP 94, Greg Holland CL 99, James Paxton SP 88, Ethan Holliday SS 95 | Arjun Nimmala 3B 94, Luis Pena 2B 90, Jeff Francoeur RF 81, Jered Weaver SP 89, Duane Ward CL 98, Kyle Freeland SP 91, Payton Tolle SP 99, Sebastian Walcott SS 89 |
| 533 | Daily Wide Open | 771.1 → 839.3 | +68.2 | Ed Delahanty LF 103, Curtis Granderson CF 97, Matt Kemp CF 99, Rogers Hornsby 2B 101 | Carl Yastrzemski LF 103, Jose Bautista RF 100, Juan Soto RF 102, Sebastian Walcott SS 89 |
| 564 | Daily Diamond | 576.6 → 617.0 | +40.4 | Arjun Nimmala 3B 94, Trevor Story SS 88, Carlos Beltran CF 99, Matt Kemp CF 99, Sandy Alcantara SP 99, Gio Gonzalez SP 94 | JJ Wetherholt 2B 96, Honus Wagner SS 99, Darin Erstad LF 89, Kirk Gibson RF 95, Tom Glavine SP 97, Noodles Hahn SP 93 |
| 542 | Wednesday Ice to See You | 621.5 → 658.0 | +36.5 | Matt Kemp CF 99, Sandy Alcantara SP 99, Gio Gonzalez SP 94 | Seiya Suzuki RF 95, Don Larsen SP 96, J.J. Putz CL 99 |
| 537 | Thursday Splendid Silver Only Spectacular | 227.9 → 259.0 | +31.1 | Jonathan Lucroy C 79, Josh Harrison 3B 74, Jake McCarthy LF 72, Francisco Liriano SP 75, Percy Miller RP 78, Billy Swift CL 77, Scott Williamson CL 73, Bruce Ruffin RP 71 | Bob Boone C 73, John Henry Russell 2B 79, Marquis Grissom CF 73, Dave Bush SP 76, Chad Bradford RP 74, Mike Matthews RP 77, Jason Motte CL 78, Luis De Leon RP 77 |
| 531 | Daily Diamond Jumble Slots | 575.0 → 605.4 | +30.4 | Trevor Story SS 88, Matt Kemp CF 99, J.D. Martinez LF 85, Sandy Alcantara SP 99, Gio Gonzalez SP 94, James Paxton SP 88, Steve Howe CL 82 | Pythias Russ SS 89, Darin Erstad LF 89, Seiya Suzuki RF 95, Tom Glavine SP 97, Nolan McLean SP 93, Yennier Cano RP 88, Troy Percival RP 87 |
| 587 | Daily Diamonds are Forever | 561.0 → 591.0 | +30.0 | Mark Teixeira 1B 94, Trevor Story SS 88, Matt Kemp CF 99, Sandy Alcantara SP 99, Gio Gonzalez SP 94, J.J. Putz CL 99, Joel Pineiro SP 91 | Darin Erstad LF 89, Ryan Braun 3B 74, Babe Ruth SP 97, Tom Glavine SP 97, Tyler Matzek RP 98, Johnny Markham RP 87, Colt Emerson SS 98 |
| 560 | Daily Open Slots | 574.1 → 602.9 | +28.8 | Ed Bailey C 97, Trevor Story SS 88, Matt Kemp CF 99, Steve Pearce 1B 69, Chris Sale SP 103, John Bale RP 59, Javier Baez 2B 49 | Rick Wilkins C 92, Pythias Russ SS 89, Carlos Beltran CF 99, Ernie Clement 3B 64, Josh Hader CL 104, Justin Verlander SP 58, Chris Taylor SS 59 |
| 772 | Daily Iron & Friends OOTP Era Slots | 170.0 → 198.0 | +28.0 | Trevor Story SS 88, Nelson Cruz RF 68, Carlos Gomez CF 79, Matt Kemp CF 99, Matt Davidson 1B 56, Jose Quintana SP 59, Jason Schmidt SP 54 | Jeremy Pena SS 79, Carlos Beltran CF 99, Eric Byrnes LF 67, Carlos Pena 1B 89, Jeff Francis SP 53, Dallas Braden SP 57, Lenny Harris 3B 52 |
| 9100190 | Daily Silver & Friends Slots | 406.1 → 433.5 | +27.4 | Jonathan Lucroy C 79, Alex Rodriguez 3B 102, Matt Kemp CF 99, Francisco Liriano SP 75, Dennis Cook RP 76 | Bob Boone C 73, Jeremy Pena SS 79, Andruw Jones CF 102, Ed Reulbach SP 97, Zack Greinke RP 77 |
| 565 | Daily Diamond Cap | 372.8 → 398.7 | +25.9 | Trevor Story SS 88, Matt Kemp CF 99, Sandy Alcantara SP 99, Jack Stivetts SP 87, Joe Thatcher RP 44, Dallas Keuchel SP 48, Stan Hack 3B 46, Rougned Odor 2B 42 | Jeremy Pena SS 79, Curtis Granderson CF 97, Jerry Koosman SP 98, Cy Young SP 99, James McDonald SP 55, Todd Jones CL 43, Greasy Neale RF 42, George Pinkney 3B 40 |
| 9100139 | Daily All-Star Hardware Slots | 681.5 → 704.6 | +23.1 | Trevor Story SS 88, Kirk Gibson RF 95, Matt Kemp CF 99, Sandy Alcantara SP 99, Gio Gonzalez SP 94, Steve Howe CL 82, Jeff Reardon CL 69, Jose Quintana SP 59, Nelson Cruz RF 68 | Pedro Alvarez 3B 81, Darin Erstad LF 89, Chris Sabo 3B 66, Shane Victorino CF 69, Jerry Koosman SP 98, Don Larsen SP 96, J.J. Putz CL 99, Greg Holland CL 99, Mike Marshall CL 57 |
| 530 | Daily Gold Slots | 431.8 → 453.2 | +21.4 | Jonathan Lucroy C 79, Trevor Story SS 88, Jack Stivetts SP 87, James Paxton SP 88, Francisco Liriano SP 75, Nelson Cruz RF 68, Bill Buckner LF 64 | Bob Boone C 73, Pythias Russ SS 89, CC Sabathia SP 82, Cherokee Fisher SP 82, Chad Bradford RP 74, Paul Waner RF 61, Jack Tobin RF 61 |
| 583 | Daily Iron Dreamland | 13.0 → 32.9 | +19.9 | Rick Wilkins C 57, Danny Espinosa 2B 54, Jose Quintana SP 59, Sergio Romo RP 45 | Ted Easterly C 58, Freddy Galvis SS 58, Tomoyuki Sugano SP 58, Seranthony Dominguez RP 59 |
| 519 | Daily Low Bronze Only | 54.1 → 73.9 | +19.8 | James McCann C 63, Khalil Greene SS 62, Jaime Garcia SP 64, Damon Berryhill C 61 | Bill Killefer C 64, Tony Pena Sr. C 62, Mark Bellhorn 2B 64, Kyson Witherspoon SP 63 |
| 9100187 | Thursday CWhit's Say My Name Cap | 419.2 → 438.3 | +19.1 | Aiva Arquette SS 71, Trevor Story SS 88, Bo Jackson LF 88, Matt Kemp CF 99, Sandy Alcantara SP 99, Gio Gonzalez SP 94, Jerry Augustine RP 42, Rougned Odor 2B 42, Tsung-Che Cheng 2B 44 | Sebastian Walcott SS 89, Ed Williamson 3B 100, Arjun Nimmala 3B 94, Kirk Gibson RF 95, Babe Ruth SP 97, Fritz Ostermueller SP 64, Tin Can Kincannon SP 45, Jerome Walton CF 43, George Pinkney 3B 40 |
| 567 | Daily Goldfather II | 438.7 → 457.4 | +18.7 | Trevor Story SS 88, Jimmie Lyons CF 84, Bob Boone C 88, Mike Donlin LF 83, James Paxton SP 88, Steve Howe CL 82, Christian Yelich LF 83 | Bob Boone C 73, Zyhir Hope LF 86, Mike Zunino C 75, Alex Rios RF 76, Tony Watson RP 87, Raisel Iglesias SP 80, Sam Wise SS 88 |
| 539 | Tuesday Sporer's Sandlot | 396.1 → 414.1 | +18.0 | Josh Harrison 3B 74, Trevor Story SS 88, Christian Yelich LF 83, Ernie Clement 3B 64, Hyun-jin Ryu SP 86, James Paxton SP 88, Steve Howe CL 82 | Joey Votto 1B 84, Jeremy Pena SS 79, Kal Daniels LF 82, Danny Jackson SP 88, J.A. Happ SP 87, Tony Watson RP 87, Jose Oquendo 2B 73 |
| 569 | Friday Nightmare Cap | 200.7 → 217.4 | +16.7 | Aiva Arquette SS 71, Placido Polanco 2B 77, Nelson Cruz RF 68, Francisco Liriano SP 75, Erik Hanson SP 69, Jeff Reardon CL 69, Evan Sisk RP 66, Bill Duggleby SP 65 | Matt Carpenter 3B 74, Jefferson Rojas SS 66, Billy Southworth RF 68, Jordan Montgomery SP 77, Gene Conley SP 77, Cool Papa Bell SP 68, Brock Burke RP 65, Mason Fluharty RP 65 |
| 541 | Saturday Diamond Variety | 445.1 → 461.8 | +16.7 | Arky Vaughan SS 92, Jimmie Lyons CF 84, Roy Campanella C 97, Steel Arm Davis LF 88, Larry Doby 2B 98 | Mickey Mantle CF 88, Roger Peckinpaugh SS 96, Al Simmons LF 99, Hank Thompson 3B 87, Mack Eggleston C 88 |
| 9100191 | Daily Low Gold Cap | 224.5 → 241.0 | +16.5 | Mike Zunino C 75, Nelson Cruz RF 68, Ray Knight 3B 51, Francisco Liriano SP 75, Dallas Keuchel SP 48, Joe Thatcher RP 44, Charlie Morton SP 46, Ken Griffey Jr. CF 45, Rougned Odor 2B 42 | Josh Gibson C 84, Carlos Gomez CF 79, Cherokee Fisher SP 82, Steve Farr CL 43, Bob Gibson SP 44, R.T. Walker RP 40, Charlie Eden LF 40, Jerome Walton CF 43, Jim Maloney SP 41 |
| 527 | Daily Bronze Only Curiosities | 125.1 → 141.2 | +16.1 | Khalil Greene SS 62, Erik Hanson SP 69, Austin Adams RP 69, Jaime Garcia SP 64 | Scott Spiezio 1B 67, Paul Assenmacher RP 62, Justin Masterson SP 60, Milo Candini SP 67 |
| 633 | Daily Bronze OOTP Era | 142.2 → 157.4 | +15.2 | Khalil Greene SS 62, Nelson Cruz RF 68, Ernie Clement 3B 64, Jaime Garcia SP 64, Jose Quintana SP 59 | Shane Victorino CF 69, Steve Pearce 1B 69, Jake Bloss SP 67, Dallas Keuchel SP 48, Jhonny Level SS 64 |
| 9100198 | Daily Gold Standard | 362.1 → 376.8 | +14.7 | Trevor Story SS 88, James Paxton SP 88, Francisco Liriano SP 75, Steve Howe CL 82, Kaelen Culpepper SS 89, Socks Seybold RF 88 | Brian Roberts 2B 87, Jeremy Pena SS 79, Justin Verlander SP 87, Vean Gregg SP 85, Yennier Cano RP 88, Shoeless Joe Jackson LF 88 |
| 546 | Sunday Open Slots | 809.1 → 823.3 | +14.2 | Ed Bailey C 97, Trevor Story SS 88, Matt Kemp CF 99, Francisco Liriano SP 75, Nelson Cruz RF 68 | Rick Wilkins C 92, Kaelen Culpepper SS 89, Seiya Suzuki RF 95, Jacob deGrom SP 79, Bill Buckner LF 64 |
| 563 | Daily Gold Cap | 343.7 → 357.8 | +14.1 | Trevor Story SS 88, Francisco Liriano SP 75, Steve Howe CL 82, Mike Matthews RP 77, Joe Thatcher RP 44, Jim Maloney SP 41, Rougned Odor 2B 42 | Jeremy Pena SS 79, Cherokee Fisher SP 82, Joe Beggs RP 89, Alex Claudio RP 70, Steve Farr CL 43, Jerome Walton CF 43, Alex Rodriguez SS 43 |
| 635 | Daily Golden Heart | 395.0 → 409.1 | +14.1 | Bob Boone C 88, Rod Carew 2B 87, Steve Howe CL 82, Steve Bedrosian CL 84 | Bob Boone C 73, Hubie Brooks SS 76, Gregg Olson CL 88, Dan Quisenberry CL 84 |
| 9100134 | Daily Low Diamond Only | 446.6 → 460.6 | +14.0 | Gio Gonzalez SP 94 | Nolan McLean SP 93 |
| 535 | Saturday Bronze Cap | 127.7 → 141.6 | +13.9 | Ken Griffey Jr. CF 45, Jose Quintana SP 59, Joe Thatcher RP 44, Charlie Morton SP 46, Buck Rodgers C 42 | Bill Duggleby SP 65, Tin Can Kincannon SP 45, Steve Farr CL 43, Ali Sanchez C 42, Leo Durocher SS 41 |
| 9100165 | Daily Silver Snapshots | 209.8 → 223.1 | +13.3 | Khalil Greene SS 62, Lave Cross 3B 75, Francisco Liriano SP 75, Billy Swift CL 77 | Dave Bancroft SS 69, Richie Hebner 3B 74, Rudy May RP 74, Jonathan Loaisiga RP 77 |
| 525 | Daily Early Bronze | 125.7 → 138.7 | +13.0 | Nelson Cruz RF 68, Jeff Reardon CL 69, Erik Hanson SP 69 | Cool Papa Bell SP 68, Edwin Diaz CL 67, Jonny Gomes LF 58 |
| 516 | Daily Late Iron | 16.3 → 29.1 | +12.8 | Shawn Green 1B 59, Jose Quintana SP 59, Reed Garrett RP 49, Charlie Morton SP 46 | Ty Wigginton 1B 54, Jeff Francis SP 53, Hector Carrasco RP 59, Ossie Orwoll SP 57 |
| 523 | Daily Late Silver | 267.6 → 280.4 | +12.8 | Jonathan Lucroy C 79, John Henry Russell 2B 79, Josh Harrison 3B 74, Randy Ready 3B 77, Francisco Liriano SP 75, Mike Greenwell LF 77 | Bob Boone C 73, CJ Abrams SS 78, Brandon Phillips 2B 64, Chris Sabo 3B 66, Bruce Ruffin RP 71, Angel Genao 2B 78 |
| 9100197 | Daily Low Silver Only | 195.4 → 208.0 | +12.6 | Josh Harrison 3B 74, Raul Mondesi RF 70, Brian Jordan RF 74, Brandon McCarthy SP 72 | Duke Snider CF 73, Jake McCarthy LF 72, Bob Walk SP 73, Julio Lugo SS 73 |
| 562 | Daily Iron Lunch | -20.3 → -8.1 | +12.2 | Danny Espinosa 2B 54, Ken Berry LF 55, Jose Quintana SP 59 | Jeff Francis SP 53, Alcides Escobar SS 52, Alfredo Amezaga CF 44 |
| 538 | Sunday Silver and Gold Cap | 439.3 → 450.2 | +10.9 | Trevor Story SS 88, Francisco Liriano SP 75, Raul Mondesi RF 70 | Pythias Russ SS 89, Brad Clontz RP 73, Gus Bell CF 70 |
| 9100125 | Daily Silver Only Cap | 190.0 → 200.5 | +10.5 | Luis Aparicio SS 71, Tai Peete CF 74, Raul Mondesi RF 70, Francisco Liriano SP 75, Brandon McCarthy SP 72 | Jeremy Pena SS 79, Pop Corkhill CF 71, Gus Bell CF 70, Felix Hernandez SP 72, Kid Madden SP 70 |
| 540 | Thursday Night Gold Rush | 543.4 → 552.8 | +9.4 | Trevor Story SS 88, Justin Verlander SP 87, James Paxton SP 88 | Pythias Russ SS 89, Jack Stivetts SP 87, Luis Arroyo CL 84 |
| 773 | Daily Bronze PTCS 3 Replay Slots | 186.1 → 195.1 | +9.0 | Nelson Cruz RF 68 | Deion Sanders CF 69 |
| 556 | Daily Iron Strikes Back | -64.2 → -55.3 | +8.9 | Danny Espinosa 2B 54, Jose Quintana SP 59 | Ozzie Smith SS 59, Tyler Chatwood SP 50 |
| 544 | Monday Wonky Historical Slots | 355.1 → 363.9 | +8.8 | Roy Campanella C 97, Henry Blackmon 3B 79, Jack Stivetts SP 87 | Pythias Russ SS 89, Count Leblanc SP 89, Duke Snider CF 73 |
| 9100128 | Daily Low Gold Only | 342.5 → 351.2 | +8.7 | Christian Yelich LF 83, Mike Donlin LF 83, Norm Charlton CL 81 | Alfonso Soriano LF 83, Branch Russell RF 83, Rube Marquard SP 84 |
| 547 | Sunday Open Main Event | 832.2 → 840.8 | +8.6 | Matt Kemp CF 99, Leodalis De Vries SS 102 | Juan Soto RF 102, Sebastian Walcott SS 89 |
| 534 | Saturday Iron Warriors | -53.5 → -45.2 | +8.3 | Rick Wilkins C 57, Jose Quintana SP 59 | Roger Bresnahan C 55, Jeff Francis SP 53 |
| 522 | Daily Early Silver | 272.8 → 280.3 | +7.5 | Mike Zunino C 75, Francisco Liriano SP 75, Henry Blackmon 3B 79 | Chris Sabo 3B 66, Zack Wheeler SP 79, Judy Johnson 3B 79 |
| 9100185 | Daily Diamond Up to 1969 | 485.8 → 492.7 | +6.9 | Jimmie Lyons CF 84, Roy Campanella C 97, Jack Stivetts SP 87, Candy Jim Taylor 3B 83 | Mickey Mantle CF 88, Roger Peckinpaugh SS 96, Don Larsen SP 96, John Beckwith SS 98 |
| 536 | Monday Up And At Them Bronze | 129.0 → 135.8 | +6.8 | Nelson Cruz RF 68, Jeff Reardon CL 69, Javier Baez 2B 49 | Dave Brain 3B 68, Felipe Lopez SS 68, Adam Cimber RP 69 |
| 548 | Monday Now We're into the Dregs | 56.8 → 62.6 | +5.8 | Khalil Greene SS 62, Jose Quintana SP 59, Carter Capps RP 55, Alika Williams SS 51 | Bill Hall SS 59, Gene Krapp SP 62, Roger Mason RP 55, Dave Henderson CF 50 |
| 517 | Daily Iron Cap | -3.4 → 1.6 | +5.0 | Jose Quintana SP 59 | Big Jeff Pfeffer SP 59 |
| 524 | Daily Late Bronze | 132.0 → 134.9 | +2.9 | Khalil Greene SS 62, Nelson Cruz RF 68, Erik Hanson SP 69, Austin Adams RP 69, Jaime Garcia SP 64 | Dave Bancroft SS 69, Shane Victorino CF 69, Mickey Lolich SP 69, Adam Cimber RP 69, Bob Miller SP 69 |
| 9100166 | Daily Golden Age | 274.8 → 277.4 | +2.6 | Mike Donlin LF 83, Jack Stivetts SP 87, Steel Arm Davis LF 88, Billy Southworth RF 68 | Roy Thomas CF 82, Percy Miller RP 78, Topsy Hartsel LF 72, Candy Jim Taylor 3B 83 |
| 9100138 | Daily Early Years Cap | 279.1 → 280.9 | +1.8 | Luke Appling SS 92, Maurice Archdeacon CF 45, Fred Frankhouse RP 41, John Leary 1B 40, Tom O'Brien 1B 43, Zack Taylor C 40, Bill Shipke 3B 40 | Jack Tobin RF 61, Pop Corkhill CF 71, Jim Hughey SP 40, Walt French RF 44, Greasy Neale RF 42, Jay Faatz 1B 41 |
| 570 | Friday Danksville | -159.0 → -158.0 | +1.0 | Richard Bleier RP 49 | Don Larsen RP 49 |
