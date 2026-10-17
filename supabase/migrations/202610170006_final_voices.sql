-- The agreed set of writing voices. Each persona is one plain line, the way you'd
-- type it to ChatGPT; players can also pick one of these for how they speak.
delete from public.narrators where id not in (
 'classic-fantasy','light-witty','dark-gritty','pirate-captain','unhinged-pirate','royal-chronicler',
 'grumpy-dwarf','royal-herald','sports-commentator','nature-documentary','campfire','noir-detective','bedtime-grandparent');

insert into public.narrators(id,name,mood,blurb,sample,persona,sort) values
 ('classic-fantasy','Classic Fantasy','classic','Vivid, immersive fantasy-novel storytelling, played straight.','The torches guttered as the great gate groaned open. Somewhere below, something ancient drew breath.','Write like a classic fantasy novel.',1),
 ('light-witty','Light & Witty','classic','Playful and quick, with a grin in every paragraph.','The dragon was enormous, ancient and terrifying. It was also, unmistakably, sulking.','Write in a light, witty, playful way.',2),
 ('dark-gritty','Dark & Gritty','classic','Grounded and harsh; danger feels real and choices cost.','The rain washed the blood into the gutter, and nobody in the square looked up.','Write in a dark, gritty way.',3),

 ('pirate-captain','Pirate Captain','pirate','A proper pirate captain, rum in one hand, cutlass in the other.','The ocean be blacker than a tax collector''s heart, an'' the storm be just gettin'' started.','Write like a pirate captain.',10),
 ('unhinged-pirate','Absolutely Unhinged Pirate','pirate','Pirate turned up to eleven. ARRR in every line.','ARRRR! SOMEBODY. DRANK. THE RUM. Today, somebody walks the plank. Possibly everybody.','Write like an unhinged pirate.',11),
 ('pirate-parrot','The Captain''s Parrot','pirate','Has seen it all, squawks the juicy bits, wants crackers.','Gold! GOLD! …and then everyone fell overboard. Squawk. Cracker?','Write like the captain''s old parrot is telling it: short squawked bursts, repeating the juicy words, always wanting crackers.',12),

 ('royal-chronicler','The Royal Chronicle','medieval','King James English; every absurd deed told with total epic gravity.','Not by accident. Not through illness. But as a calculated demonstration of supreme authority.','Write like a mock-epic medieval chronicle in King James English (thou, hath), telling every absurd thing I do with total epic gravity.',20),
 ('greek-epic','Greek Epic','medieval','Homeric grandeur, epithets and meddling gods.','Sing, O Muse, of swift-footed you, who fled the battle swiftest of all the Achaeans.','Write like a Homeric Greek epic, with grand epithets.',21),
 ('grumpy-dwarf','Grumpy Dwarf','medieval','Hates elves, magic, tall people and, frankly, you.','Another forest. Trees everywhere, like they own the place. And now an elf wants to guide you.','Write like a grumpy old dwarf.',22),
 ('royal-herald','Royal Herald','medieval','Every trifle proclaimed as a booming royal decree. HEAR YE!','HEAR YE! The hero hath… opened a door! LONG LIVE THE HERO! LONG LIVE THE DOOR!','Write like a pompous royal herald.',23),

 ('fed-up','The Fed-Up Narrator','comedic','Sarcastic, exhausted, passive-aggressive — and still telling the story.','You open the cursed chest. Of course you do. Why wouldn''t you. I''m fine.','Write like a sarcastic, emotionally exhausted narrator who is openly fed up with me and my choices: dry, passive-aggressive, a little existential, but still telling the story properly.',30),
 ('sports-commentator','Sports Commentator','comedic','Breathless play-by-play, replays and a roaring crowd.','AND HE''S GONE FOR THE WINDOW! WHAT A MOVE! THE CROWD IS ON ITS FEET!','Write like a breathless sports commentator.',31),
 ('nature-documentary','Nature Documentary','comedic','Hushed and fascinated, studying the heroes like rare wildlife.','Here, in its natural habitat, the adventurer approaches the cursed chest. It has learned nothing.','Write like a nature documentary narrator.',32),

 ('campfire','Campfire Horror','atmospheric','Slow dread, long pauses, things just out of sight.','The forest went quiet. Not the normal kind of quiet. Then you heard it. Right behind you. Breathing.','Write like a campfire horror story.',40),
 ('noir-detective','Fantasy Noir','atmospheric','Hard-boiled detective prose, rain and secrets.','The wizard walked in like trouble in a pointy hat. In this town, everybody''s hiding a spell.','Write like a hard-boiled noir detective story.',41),
 ('bedtime-grandparent','Fairy Tale','atmospheric','Once upon a time: warm and cozy, even when it''s dangerous.','Once upon a time, in a kingdom with far too many dragons, there lived a hero with far too few plans.','Write like a cozy fairy tale.',42),
 ('wild-west','Wild West','atmospheric','Dust, spurs, saloons and a slow drawl.','The saloon went quiet the way a rattlesnake goes quiet, right before it bites.','Write like a dusty Wild West story with a drawl.',43),
 ('mafia-drama','Mafia Drama','atmospheric','Quiet threats, favours and family.','The baker slid a cannoli across the table. In this town, that''s not a pastry. That''s a message.','Write like a mafia drama: quiet threats, favours and family.',44)
on conflict (id) do update set name=excluded.name,mood=excluded.mood,blurb=excluded.blurb,sample=excluded.sample,persona=excluded.persona,sort=excluded.sort;

-- Stories keep their chosen voice where it survived (with the new wording); others fall back to plain.
update public.adventures s set voice=s.voice||jsonb_build_object('narratorName',n.name,'persona',n.persona)
 from public.narrators n where s.voice->>'narrator'=n.id;
update public.adventures set voice=voice-'narrator'-'narratorName'-'persona'
 where voice ? 'narrator' and voice->>'narrator'<>'custom' and not exists(select 1 from public.narrators n where n.id=voice->>'narrator');
