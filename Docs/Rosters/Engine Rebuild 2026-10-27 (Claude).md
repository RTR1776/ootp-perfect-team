# Engine rebuild: cap, slots and new-card events (Claude, 2026-10-27)

Collection 315 (Walcott FLF, Lyons, Swanson, Woo, Hunter Brown, Devers, Ramon Hernandez, Benzinger, Easterday; variants Higuera, Dennis Martinez, Caudill, Carrasco). Every current cap and slots event (22) plus the six where Walcott or Lyons start (Card Fit), rebuilt on the fixed engine:
- downgrade frontier in `roster-optimize.ts`;
- cap/slots pen weight 1.85.

8 starts each, seeded from the saved pick, L.J.'s floors. All 28 legal and saved as "Claude pick 2026-10-27 engine", rosters 1268–1295. Dregs (1266), Dank (1250) and Dead Silver (1244) were done earlier today and left alone.

**Search speed:** the first version of the fix (best two cards at every value level) ran past 14 minutes on Low Gold Cap's 40–84 window. Downgrades are now the cheapest cards plus each slot's value/rank frontier (a card off it is never the better payment). Low Gold Cap on the full pool: 2.5 min at 4 starts, 152.4, against 141.9 for the pruned (--candidate-limit 30) build saved in a hurry as 1267. The 152.4 build is the one saved (1294).

**Saturday Negro Leagues Slots** needs `--extra "--card-year-min 1800 --card-year-max 2026"`. Its NeL-only rule (card type 2) trips the field-year guard, as on 10-11.

**Sanity read, every build** (`sanity.py`: catcher C <75 or glove ≤ −3, any starter ≤ −20 bat+glove, an all-right-handed vs-RHP lineup, any ✗ check). Nothing like the Huff case. Flags, all checked and kept:
- Iron Cap: Henry Blanco catches (−29 bat, +7.9 glove): the Iron pool's best net.
- Low Gold Cap and Low Gold Only: Josh Gibson at C 69 (glove −4 to −8) for a +10 to +16 bat.
- Golden Age: Mack Eggleston C 73 (−4.9); the backup Mackey is worse.
- Friday Night Live and Time Travelers Slots: Nico Hoerner at 2B vs RHP (−16 to −18 bat). He's the only 2B clearing the 85 floor with a glove apart from Rojas (−22).

## Changes by event (cards in)

| Event | Roster | Changed | In |
|---|---|---|---|
| Daily All-Star Hardware Slots | allstarhardwareslots-claude-2026-10-27-engine.txt | 5 | Brice Turang (VAR), Bob Walk, Hideki Matsui, Shane Victorino, Don Larsen |
| Daily Bronze Only Cap | bronzeonlycapdaily-claude-2026-10-27-engine.txt | 6 | Hal Woodeshick, Jhonny Level (VAR), Kyson Witherspoon (VAR), Tony Gwynn Jr., Steve Pearce (VAR), Ramon Hernandez |
| Daily Bronze PTCS 3 Replay Slots | bronzeptcs3-claude-2026-10-27-engine.txt | 3 | Vladimir Guerrero, Bob Allison (VAR), Justin Verlander |
| Daily Diamond Cap | diamondcapdaily-claude-2026-10-27-engine.txt | 6 | Charlie Eden, Javier Baez (VAR), Curtis Granderson, Jeremy Pena, Lefty Grove, Don Larsen |
| Daily Diamond Jumble Slots | diamondslotsdaily-claude-2026-10-27-engine.txt | 6 | Billy Southworth (VAR), Curtis Granderson, Kelvim Escobar, Don Larsen, Ernie Clement, J.D. Martinez |
| Daily Early Years Cap | earlyyearscap-claude-2026-10-27-engine.txt | 7 | Jim Hughey, Bruno Block, Tom O'Brien, George Hunter, Vince DiMaggio, Johnny Bassler, Luther Farrell |
| Daily Gold Cap | goldcapdaily-claude-2026-10-27-engine.txt | 5 | Tsung-Che Cheng (VAR), Mike Marshall, Sebastian Walcott, Chuck Finley (VAR), CC Sabathia |
| Daily Gold Slots | goldslotsdaily-claude-2026-10-27-engine.txt | 3 | Dave Brain (VAR), Ryan Braun, Mickey Lolich |
| Daily Gold Standard | goldstandard-claude-2026-10-27-engine.txt | 5 | Sebastian Walcott, Mike Zunino, Andy Van Slyke, Bill Ricks, Ernie Clement |
| Daily Golden Age | goldenage-claude-2026-10-27-engine.txt | 3 | Billy Southworth (VAR), Nick Altrock, Jimmie Lyons |
| Daily Iron & Friends OOTP Era Slots | ironandfriends-claude-2026-10-27-engine.txt | 5 | Willy Adames, Jimmy Crooks (VAR), Kendry Rojas, Corey Seager, Norris Hopper |
| Daily Iron Cap | ironcapdaily-claude-2026-10-27-engine.txt | 2 | Javier Baez (VAR), Sam Bankhead |
| Daily Live Plus | liveplus-claude-2026-10-27-engine.txt | 4 | Colt Emerson (VAR), Aidan Miller, Thayron Liranzo (VAR), Sebastian Walcott |
| Daily Low Gold Only | lowgoldonly-claude-2026-10-27-engine.txt | 2 | Rafael Furcal, Jimmie Lyons |
| Daily Silver & Friends Slots | silverfriendsslots-claude-2026-10-27-engine.txt | 5 | Andy Van Slyke, Madison Bumgarner, Chris Sabo, Orlando Hernandez, Ernie Clement |
| Daily Silver Only Cap | silveronlycapdaily-claude-2026-10-27-engine.txt | 2 | Daulton Varsho, Cristian Guzman |
| Daily Silver Slots | silverslotsdaily-claude-2026-10-27-engine.txt | 1 | Jonny Gomes |
| Dr. Dynastic's Daily Time Travelers Slots | timetravelersslots-claude-2026-10-27-engine.txt | 1 | Jake Bauers |
| Friday Night Live Slots | liveslotsweekly-claude-2026-10-27-engine.txt | 1 | Pete Alonso |
| Friday Nightmare Cap | nightmarecap-claude-2026-10-27-engine.txt | 5 | Derek Hill, Matt Carpenter, Mark Grudzielanek, Bill Ricks, Livan Hernandez |
| Live-Plus Diamond Pop-up | liveplusdiamondpopup-claude-2026-10-27-engine.txt | 9 | Calvin Faucher, Hagen Smith, Liam Doyle, Ryan Sloan, Rainiel Rodriguez, Zyhir Hope (VAR), Aiva Arquette (VAR), Thayron Liranzo (VAR), Sebastian Walcott |
| Live-Plus Gold Pop-up | liveplusgoldpopup-claude-2026-10-27-engine.txt | 16 | Tyler Rogers, Hagen Smith, Carson Williams (VAR), Eduardo Tait, Elmer Rodriguez, George Klassen (VAR), Luis De Leon (VAR), Caden Scarborough (VAR), Jeferson Quero (VAR), Aiva Arquette (VAR), Travis Sykora (VAR), Charlie Condon, Jack Wenninger, Jaxon Wiggins, Josue Briceno (VAR), Sebastian Walcott |
| Saturday Bronze Cap | bronzecapweekly-claude-2026-10-27-engine.txt | 3 | Jim Maloney, Chuck Cottier, Ray Dandridge |
| Sunday Open Slots | openslotsweekly-claude-2026-10-27-engine.txt | 5 | Curtis Granderson, Bob Bowman (VAR), Don Larsen, Ernie Clement, Mickey Lolich |
| Sunday Silver and Gold Cap | highironfloorgoldceilingweekly-claude-2026-10-27-engine.txt | 4 | Kaelen Culpepper (VAR), Mitch Webster, Bob Gibson, Jeremy Pena |
| Thursday CWhit's Say My Name Cap | c4q1-claude-2026-10-27-engine.txt | 10 | Tsung-Che Cheng (VAR), Tin Can Kincannon, Javier Baez (VAR), Hideki Matsui, Pythias Russ (VAR), Alfredo Amezaga, Brandon Phillips, Don Larsen, Darin Erstad, Ernie Clement |
| Daily Low Gold Cap | lowgoldcap-claude-2026-10-27-frontier.txt | 6 | Ed Gremminger, Chuck Cottier, Jeff Francoeur (VAR), Todd Jones (VAR), Pedro Alvarez, Ryan Braun |
| Saturday Negro Leagues Slots | nelslotsweekly-claude-2026-10-27-engine-nel.txt | 7 | Pedro Pages, Satchel Paige, Cool Papa Bell, Connie Day, Sam Bankhead, Charlie Blackwell, Jimmie Lyons |
