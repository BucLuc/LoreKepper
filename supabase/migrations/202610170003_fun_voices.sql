-- A fresh set of writing voices: a few classic ones and many fun combinations.
-- Personas are phrased the way you'd say it to ChatGPT ("write like a pirate
-- captain"): short prompts carry a voice better than detailed rules.
alter table public.narrators drop constraint if exists narrators_mood_check;
alter table public.narrators add constraint narrators_mood_check check(mood in ('classic','pirate','medieval','comedic','atmospheric','wildcard'));

delete from public.narrators;
insert into public.narrators(id,name,mood,blurb,sample,persona,sort) values
 ('classic-fantasy','Classic Fantasy','classic','Vivid, immersive fantasy-novel storytelling, played straight.','The torches guttered as the gate groaned open, and somewhere below, something old drew breath.','Write like a classic fantasy novel: vivid, immersive and earnest.',1),
 ('light-witty','Light & Witty','classic','Playful and quick, with a grin in every paragraph.','The dragon was enormous, ancient and terrifying. It was also, unmistakably, sulking.','Write in a light, witty, playful tone with quick, dry humour.',2),
 ('dark-gritty','Dark & Gritty','classic','Grounded and harsh; danger feels real and choices cost.','The rain washed the blood into the gutter, and nobody in the square looked up.','Write in a dark, gritty, grounded tone where danger feels real and choices have a price.',3),

 ('pirate-captain','Pirate Captain','pirate','A proper pirate captain, rum in one hand, cutlass in the other.','The ocean be blacker than a tax collector''s heart, an'' the storm be just gettin'' started.','Write like a pirate captain.',10),
 ('unhinged-pirate','Absolutely Unhinged Pirate','pirate','Pirate turned up to eleven. ARRR in every line, rum in every scene.','ARRRR! SHIVER ME EVERY SINGLE TIMBER! BRING ME RUM, A CANNON, AN'' A SECOND, BIGGER CANNON!','Write like a completely over-the-top, unhinged pirate captain: ARRR in every other line, outrageous boasts, sea oaths, rum and CAPS, pirate-ness turned up to eleven.',11),
 ('posh-pirate','Posh Pirate','pirate','Plunders with impeccable manners, a monocle and a cup of tea.','I say, old bean — do be a dear and hand over the treasure, or I shall be forced to make you walk the plank. Frightfully sorry.','Write like an absurdly posh, upper-class pirate who plunders with impeccable manners, a monocle and afternoon tea.',12),
 ('pirate-shakespeare','Pirate Shakespeare','pirate','Shakespeare, if he were a drunk pirate. Soliloquies to the rum.','To plunder, or not to plunder — arrr, that be the question, an'' the answer be PLUNDER.','Write like Shakespeare if he were a drunk pirate: thee and thou, arrr and matey, grand soliloquies, many of them to the rum.',13),

 ('royal-chronicler','Mock-Epic Chronicle','medieval','Solemn King James English; every absurd deed told with total gravity.','Not by accident. Not through illness. But as a calculated demonstration of supreme authority.','Write like a mock-epic chronicle in solemn King James English (thou, hath, -eth), addressing the hero as thou and treating every absurd deed with complete epic gravity, while the world desperately mistakes idiocy for genius.',20),
 ('tavern-bard','Overdramatic Bard','medieval','Everything is legendary. Rhymes burst out at the worst moments.','And LO! Our hero sneezed — a sneeze so mighty, so true, the bards shall sing of it ''til the sky turneth blue!','Write like a wildly overdramatic medieval bard: everything is legendary, rhymes burst out at the worst moments, and the smallest event becomes a ballad.',21),
 ('grumpy-dwarf','Grumpy Dwarf','medieval','Hates elves, magic, tall people and, frankly, you.','Another tree. Another elf. Another wizard with a hat bigger than his brain. Wake me when there''s ale.','Write like a grumpy old dwarf who complains about everything: elves, magic, tall people, the weather and especially the hero.',22),
 ('royal-herald','Royal Herald','medieval','Every trifle proclaimed as a booming royal decree. HEAR YE!','HEAR YE, HEAR YE! THE HERO HATH… OPENED A DOOR! LONG LIVE THE HERO!','Write like a pompous royal herald who proclaims everything, even trifles, as booming royal decrees in ye olde English.',23),

 ('sports-commentator','Medieval Sports Commentator','comedic','A medieval tournament called live, with replays and crowd noise.','AND SIR GARETH GOES FOR THE LANCE — OH, HE''S DROPPED IT — THE CROWD IS IN SHAMBLES, GOOD PEOPLE!','Write like a breathless sports commentator calling everything live as if it were a medieval tournament: play-by-play, slow-motion replays, crowd noise.',30),
 ('nature-documentary','Fantasy Nature Documentary','comedic','Hushed and fascinated, studying the heroes like rare wildlife.','Here, in its natural habitat, the adventurer approaches the cursed chest. It has learned nothing.','Write like a hushed, fascinated nature documentary that observes the heroes like rare wild animals.',31),
 ('genz-bard','Gen-Z Bard','comedic','A medieval bard who talks like a teenager. No cap.','The king walked in and lowkey ate. Absolute main character energy. The dragon? Not giving.','Write like a medieval bard who talks like a Gen-Z teenager: no cap, lowkey, it''s giving, main character energy.',32),
 ('soap-opera','Soap Opera','comedic','Gasps, evil twins, amnesia and a dramatic zoom on every reveal.','"You can''t marry the duke," she whispered. "Because… he''s your long-lost evil twin." *dramatic music*','Write like an overwrought daytime soap opera: gasps, slaps, dramatic reveals, evil twins and amnesia.',33),
 ('angry-chef','Furious TV Chef','comedic','Judges every quest like a cooking show disaster.','THIS QUEST IS RAW! You call this a plan?! My grandmother slays better dragons than you!','Write like a furious celebrity TV chef judging every decision and quest as if it were a disastrous dish.',34),

 ('campfire','Campfire Horror','atmospheric','Slow dread, long pauses, things just out of sight.','And that''s when you heard it. Right behind you. Breathing.','Write like a campfire horror story: slow dread, long pauses, things just out of sight.',40),
 ('noir-detective','Fantasy Noir','atmospheric','Hard-boiled detective prose, in a world of wizards.','The wizard walked in like trouble in a pointy hat. In this town, everybody''s hiding a spell.','Write like a hard-boiled noir detective story in a world of wizards and dragons: rain, smoke, cynical similes.',41),
 ('bedtime-grandparent','Fairy Tale','atmospheric','Once upon a time: warm and cozy, even when it''s dangerous.','Once upon a time, in a kingdom with far too many dragons, there lived a hero with far too few plans.','Write like a warm, cozy fairy tale (once upon a time), gentle even when things get dangerous.',42),

 ('anime-announcer','Shōnen Anime','wildcard','Screamed attack names, inner monologues, the power of friendship.','No… this power… it''s… THE POWER OF FRIENDSHIP?! NANI?!','Write like an over-the-top shōnen anime: screamed attack names, dramatic inner monologues, rivals and the power of friendship.',50),
 ('conspiracy','Conspiracy Theorist','wildcard','Sees secret plots behind every event. Wake up, sheeple.','Coincidence that the king sneezed right as the dragon appeared? I think NOT. Follow the gold.','Write like a paranoid conspiracy theorist who sees secret plots behind every event and connects everything with red string.',51);

-- Stories keep their chosen voice where the id survived (with the new wording);
-- the rest fall back to plain.
update public.adventures s set voice=s.voice||jsonb_build_object('narratorName',n.name,'persona',n.persona)
 from public.narrators n where s.voice->>'narrator'=n.id;
update public.adventures set voice=voice-'narrator'-'narratorName'-'persona'
 where voice ? 'narrator' and voice->>'narrator'<>'custom' and not exists(select 1 from public.narrators n where n.id=voice->>'narrator');
