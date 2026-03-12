-- =============================================================================
-- Paragon System – Editorial Board Seed
-- Academic Year 2025–2026
-- =============================================================================
-- HOW TO USE
--   1. Start the backend so the DB tables exist (npm run dev in /backend).
--   2. Open psql or your DB client and connect to the paragon database.
--   3. (Optional) Replace placeholder emails below with real ones.
--   4. Run this file: \i /path/to/seed.sql
-- =============================================================================

DO $$
DECLARE
  v_board_id UUID;

  -- Staff IDs (resolved after INSERT via name lookup)
  v_vincent    UUID;
  v_leninmarx  UUID;
  v_jasper     UUID;
  v_jet        UUID;
  v_threexia   UUID;
  v_sofia      UUID;
  v_jayriel    UUID;
  v_nathalia   UUID;
  v_kriszelle  UUID;
  v_vibien     UUID;
  v_shalley    UUID;
  v_karen      UUID;
  v_kc         UUID;
  v_shaneloise UUID;
  v_lyka       UUID;
  v_kriztan    UUID;
  v_lyzette    UUID;
  v_precious   UUID;
  v_lucky      UUID;
  v_erizalyn   UUID;
  v_leonard    UUID;
  v_carmela    UUID;
  v_jhone      UUID;
  v_shaneaaron UUID;
  v_jhadee     UUID;
  v_joyce      UUID;
  v_ashley     UUID;
  v_angelo     UUID;
  v_korina     UUID;
  v_johnrey    UUID;
  v_crisanto   UUID;
  v_johndavid  UUID;
  v_karizza    UUID;
  v_wilhelm    UUID;
  v_johnemerson UUID;
  v_sheena     UUID;
  v_jesiebel   UUID;
  v_erickson   UUID;
  v_jenny      UUID;
  v_rheajeane  UUID;
  v_alexandra  UUID;
  v_darren     UUID;
  v_antoinette UUID;
  v_hadrian    UUID;

BEGIN

  -- ===========================================================================
  -- 1. Create the editorial board
  -- ===========================================================================
  INSERT INTO editorial_boards (academic_year, adviser_name)
  VALUES ('2025–2026', 'Dr. Louraine Chriselle Seguritan')
  RETURNING id INTO v_board_id;

  RAISE NOTICE 'Created board: %', v_board_id;

  -- ===========================================================================
  -- 2. Insert staff members
  --    Replace placeholder emails with real ones before running if needed.
  -- ===========================================================================
  INSERT INTO staff_members (full_name, email) VALUES ('Vincent Carl Cabasug',           'vincent.cabasug@placeholder.edu')     RETURNING id INTO v_vincent;
  INSERT INTO staff_members (full_name, email) VALUES ('Lenin Marx Siazon',               'leninmarx.siazon@placeholder.edu')    RETURNING id INTO v_leninmarx;
  INSERT INTO staff_members (full_name, email) VALUES ('Jasper Kent Ines',                'jasper.ines@placeholder.edu')         RETURNING id INTO v_jasper;
  INSERT INTO staff_members (full_name, email) VALUES ('Jet Siazon',                      'jet.siazon@placeholder.edu')          RETURNING id INTO v_jet;
  INSERT INTO staff_members (full_name, email) VALUES ('Threexia Mei Butacan',            'threexia.butacan@placeholder.edu')    RETURNING id INTO v_threexia;
  INSERT INTO staff_members (full_name, email) VALUES ('Sofia Michelle Alicay',           'sofia.alicay@placeholder.edu')        RETURNING id INTO v_sofia;
  INSERT INTO staff_members (full_name, email) VALUES ('Jayriel Biel Andrei Galano',      'jayriel.galano@placeholder.edu')      RETURNING id INTO v_jayriel;
  INSERT INTO staff_members (full_name, email) VALUES ('Nathalia Isabel Galicha',         'nathalia.galicha@placeholder.edu')    RETURNING id INTO v_nathalia;
  INSERT INTO staff_members (full_name, email) VALUES ('Kriszelle Anne Gonzales',         'kriszelle.gonzales@placeholder.edu')  RETURNING id INTO v_kriszelle;
  INSERT INTO staff_members (full_name, email) VALUES ('Vibien Airah Soller',             'vibien.soller@placeholder.edu')       RETURNING id INTO v_vibien;
  INSERT INTO staff_members (full_name, email) VALUES ('Shalley Keith Lapat',             'shalley.lapat@placeholder.edu')       RETURNING id INTO v_shalley;
  INSERT INTO staff_members (full_name, email) VALUES ('Karen Joy Garrote',               'karen.garrote@placeholder.edu')       RETURNING id INTO v_karen;
  INSERT INTO staff_members (full_name, email) VALUES ('K.C. Nicole Quintos',             'kc.quintos@placeholder.edu')          RETURNING id INTO v_kc;
  INSERT INTO staff_members (full_name, email) VALUES ('Shane Loise Chorping',            'shaneloise.chorping@placeholder.edu') RETURNING id INTO v_shaneloise;
  INSERT INTO staff_members (full_name, email) VALUES ('Lyka Mae Ascueta',                'lyka.ascueta@placeholder.edu')        RETURNING id INTO v_lyka;
  INSERT INTO staff_members (full_name, email) VALUES ('Kriztan Dwayne Mayo',             'kriztan.mayo@placeholder.edu')        RETURNING id INTO v_kriztan;
  INSERT INTO staff_members (full_name, email) VALUES ('Lyzette Kate Tajadao',            'lyzette.tajadao@placeholder.edu')     RETURNING id INTO v_lyzette;
  INSERT INTO staff_members (full_name, email) VALUES ('Precious Angel Seguritan',        'precious.seguritan@placeholder.edu')  RETURNING id INTO v_precious;
  INSERT INTO staff_members (full_name, email) VALUES ('Lucky Jewel Rabara',              'lucky.rabara@placeholder.edu')        RETURNING id INTO v_lucky;
  INSERT INTO staff_members (full_name, email) VALUES ('Erizalyn Manalang',               'erizalyn.manalang@placeholder.edu')   RETURNING id INTO v_erizalyn;
  INSERT INTO staff_members (full_name, email) VALUES ('Leonard Jake Cabais',             'leonard.cabais@placeholder.edu')      RETURNING id INTO v_leonard;
  INSERT INTO staff_members (full_name, email) VALUES ('Carmela Marie Calica',            'carmela.calica@placeholder.edu')      RETURNING id INTO v_carmela;
  INSERT INTO staff_members (full_name, email) VALUES ('Jhone Mark Alejandro',            'jhone.alejandro@placeholder.edu')     RETURNING id INTO v_jhone;
  INSERT INTO staff_members (full_name, email) VALUES ('Shane Aaron Cruzado',             'shaneaaron.cruzado@placeholder.edu')  RETURNING id INTO v_shaneaaron;
  INSERT INTO staff_members (full_name, email) VALUES ('Jhadee Sebastian',                'jhadee.sebastian@placeholder.edu')    RETURNING id INTO v_jhadee;
  INSERT INTO staff_members (full_name, email) VALUES ('Joyce Galdecan',                  'joyce.galdecan@placeholder.edu')      RETURNING id INTO v_joyce;
  INSERT INTO staff_members (full_name, email) VALUES ('Ashley Vann Solocon',             'ashley.solocon@placeholder.edu')      RETURNING id INTO v_ashley;
  INSERT INTO staff_members (full_name, email) VALUES ('Angelo Manaday',                  'angelo.manaday@placeholder.edu')      RETURNING id INTO v_angelo;
  INSERT INTO staff_members (full_name, email) VALUES ('Korina Adelle Sumajit',           'korina.sumajit@placeholder.edu')      RETURNING id INTO v_korina;
  INSERT INTO staff_members (full_name, email) VALUES ('John Rey Torres',                 'johnrey.torres@placeholder.edu')      RETURNING id INTO v_johnrey;
  INSERT INTO staff_members (full_name, email) VALUES ('Crisanto Socia Jr.',              'crisanto.socia@placeholder.edu')      RETURNING id INTO v_crisanto;
  INSERT INTO staff_members (full_name, email) VALUES ('John David Laurente',             'johndavid.laurente@placeholder.edu')  RETURNING id INTO v_johndavid;
  INSERT INTO staff_members (full_name, email) VALUES ('Karizza Calipdan',                'karizza.calipdan@placeholder.edu')    RETURNING id INTO v_karizza;
  INSERT INTO staff_members (full_name, email) VALUES ('Wilhelm Keith Dela Rosa',         'wilhelm.delarosa@placeholder.edu')    RETURNING id INTO v_wilhelm;
  INSERT INTO staff_members (full_name, email) VALUES ('John Emerson Castro',             'johnemerson.castro@placeholder.edu')  RETURNING id INTO v_johnemerson;
  INSERT INTO staff_members (full_name, email) VALUES ('Sheena Mae Seguritan',            'sheena.seguritan@placeholder.edu')    RETURNING id INTO v_sheena;
  INSERT INTO staff_members (full_name, email) VALUES ('Jesiebel May Ocon',               'jesiebel.ocon@placeholder.edu')       RETURNING id INTO v_jesiebel;
  INSERT INTO staff_members (full_name, email) VALUES ('Erickson Manalang',               'erickson.manalang@placeholder.edu')   RETURNING id INTO v_erickson;
  INSERT INTO staff_members (full_name, email) VALUES ('Jenny Liza Samaniego',            'jenny.samaniego@placeholder.edu')     RETURNING id INTO v_jenny;
  INSERT INTO staff_members (full_name, email) VALUES ('Rheajeane Sadac',                 'rheajeane.sadac@placeholder.edu')     RETURNING id INTO v_rheajeane;
  INSERT INTO staff_members (full_name, email) VALUES ('Alexandra Ann Louise Fabillar',   'alexandra.fabillar@placeholder.edu')  RETURNING id INTO v_alexandra;
  INSERT INTO staff_members (full_name, email) VALUES ('Darren Jay Aglibao',              'darren.aglibao@placeholder.edu')      RETURNING id INTO v_darren;
  INSERT INTO staff_members (full_name, email) VALUES ('Antoinette Agramon',              'antoinette.agramon@placeholder.edu')  RETURNING id INTO v_antoinette;
  INSERT INTO staff_members (full_name, email) VALUES ('Hadrian Solmerin',                'hadrian.solmerin@placeholder.edu')    RETURNING id INTO v_hadrian;

  RAISE NOTICE 'Inserted 44 staff members';

  -- ===========================================================================
  -- 3. Assign members to board sections
  --    Note: some members appear in multiple sections (e.g. Vincent, Jet, etc.)
  -- ===========================================================================

  -- Executive Editors
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_vincent,   'Executive Editors', 'Senior Editor-In-Chief');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_leninmarx, 'Executive Editors', 'Junior Editor-In-Chief');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jasper,    'Executive Editors', 'Associate Editor (Print)');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jet,       'Executive Editors', 'Associate Editor (Online)');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_threexia,  'Executive Editors', 'Associate Editor (Broadcast)');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_sofia,     'Executive Editors', 'Managing Editor');

  -- Section Editors
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jet,       'Section Editors', 'News Editor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_sofia,     'Section Editors', 'News Editor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jayriel,   'Section Editors', 'Column Editor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_nathalia,  'Section Editors', 'DevCom Editor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_kriszelle, 'Section Editors', 'Feature Editor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jasper,    'Section Editors', 'Sports Editor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_vibien,    'Section Editors', 'Sports Editor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_shalley,   'Section Editors', 'Literary Editor');

  -- Staff Writers
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_karen,      'Staff Writers', 'News Writer');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_kc,         'Staff Writers', 'Column Writer');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_shaneloise, 'Staff Writers', 'Feature Writer');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_lyka,       'Staff Writers', 'Feature Writer');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_kriztan,    'Staff Writers', 'Feature Writer');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_lyzette,    'Staff Writers', 'DevCom Writer');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_precious,   'Staff Writers', 'DevCom Writer');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_lucky,      'Staff Writers', 'Sports Writer');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_erizalyn,   'Staff Writers', 'Literary Writer');

  -- Senior Creative Producers
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_leonard,   'Senior Creative Producers', 'Cartoonist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_carmela,   'Senior Creative Producers', 'Cartoonist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jhone,     'Senior Creative Producers', 'Cartoonist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_shaneaaron,'Senior Creative Producers', 'Cartoonist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jhadee,    'Senior Creative Producers', 'Photojournalist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_joyce,     'Senior Creative Producers', 'Photojournalist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_ashley,    'Senior Creative Producers', 'Photojournalist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_angelo,    'Senior Creative Producers', 'Video Journalist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_vincent,   'Senior Creative Producers', 'Layout Artist');

  -- Junior Creative Producers
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_korina,      'Junior Creative Producers', 'Cartoonist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_johnrey,     'Junior Creative Producers', 'Cartoonist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_crisanto,    'Junior Creative Producers', 'Contributor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_johndavid,   'Junior Creative Producers', 'Contributor');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_karizza,     'Junior Creative Producers', 'Photojournalist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_wilhelm,     'Junior Creative Producers', 'Video Journalist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_johnemerson, 'Junior Creative Producers', 'Video Journalist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_sheena,      'Junior Creative Producers', 'Layout Artist');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jesiebel,    'Junior Creative Producers', 'Layout Artist');

  -- Broadcasters
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_erickson,   'Broadcasters', 'Senior Broadcaster');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_jenny,      'Broadcasters', 'Senior Broadcaster');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_rheajeane,  'Broadcasters', 'Junior Broadcaster');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_alexandra,  'Broadcasters', 'Junior Broadcaster');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_darren,     'Broadcasters', 'Junior Broadcaster');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_antoinette, 'Broadcasters', 'Junior Broadcaster');
  INSERT INTO editorial_board_members (board_id, staff_id, section, role) VALUES (v_board_id, v_hadrian,    'Broadcasters', 'Junior Broadcaster');

  RAISE NOTICE 'Inserted 48 board member assignments across 6 sections';
  RAISE NOTICE 'Done! Board ID: %', v_board_id;

END $$;
