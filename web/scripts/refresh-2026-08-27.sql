-- Bronze + Iron daily refresh, from L.J.'s in-game announcement 2026-08-27.
-- The 8/24 databotai crawl already carried the renames (replaced in place —
-- no rows to retire); this patches the fields the crawl missed or lagged on.
-- Team point-caps (1689/1300/1820) and variant caps are announced here but
-- not yet modeled; see roadmap item 7. Run AFTER import:tournaments.

-- Bronze
update tournaments set entrants = 128, dh = false, stadium = '1945 Wrigley Field', park_name = 'Wrigley Field', updated_at = now() where id = 525;              -- Daily Early Bronze
update tournaments set entrants = 64, dh = true, stadium = '2005 Minute Maid Park', updated_at = now() where id = 527;                                          -- Daily Bronze Only Curiosities (no Minute Maid factor row yet)
update tournaments set dh = true, stadium = '2026 American Family Field', park_name = 'American Family Field', updated_at = now() where id = 520;               -- Daily Bronze Only Cap (team cap 1689, variant cap 13 — unmodeled)
update tournaments set entrants = 64, updated_at = now() where id = 584;                                                                                        -- Daily Bronze 1910-59
update tournaments set entrants = 128, updated_at = now() where id = 633;                                                                                       -- Daily Bronze OOTP Era

-- Iron
update tournaments set dh = true, updated_at = now() where id = 516;                                                                                            -- Daily Late Iron: announcement says DH on
update tournaments set stadium = '2026 Petco Park', park_name = 'Petco Park', updated_at = now() where id = 518;                                                -- Daily Live Iron
update tournaments set stadium = '2026 Rio Grande Credit Union Field at Isotopes Park', park_name = 'Rio Grande Credit Union Field at Isotopes Park', updated_at = now() where id = 517; -- Daily Iron Cap (team cap 1300, variant cap 14 — unmodeled)
update tournaments set stadium = '1886 Swampoodle Grounds', park_name = 'Swampoodle Grounds', updated_at = now() where id = 583;                                -- Daily Iron Dreamland

-- New quick (databotai lists it as "Quick Dank")
update tournaments set entrants = 16, dh = true, mode = 'Bo5', stadium = 'Heinsohn Ballpark', park_name = 'Heinsohn Ballpark', updated_at = now() where id = 905;
