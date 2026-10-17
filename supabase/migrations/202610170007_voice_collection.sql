-- The voice collection, grouped by theme. Ids of earlier voices are reused where the
-- idea carried over, so stories that chose them keep a matching voice.
alter table public.narrators drop constraint if exists narrators_mood_check;

delete from public.narrators where id not in (
 'classic-fantasy','absolute-cinema','epic-poet','manuscript-scribe','tavern-bard','medieval-chronicler','royal-herald','royal-chronicler',
 'pirate-balladeer','drunken-pirate','swashbuckler','old-sea-dog','pirate-captain','greek-epic','greek-philosopher','samurai-master',
 'noir-detective','wild-west','mafia-drama','fed-up','courtroom-judge','spaceship-ai','motivational-coach','nature-documentary');

insert into public.narrators(id,name,mood,blurb,sample,persona,sort) values
 ('classic-fantasy','Classic Storyteller','classic','Clear, natural prose with vivid scenes and believable dialogue.','The gate groaned open. Beyond it, the old road wound down into the valley, black with rain.','Write in clear, natural prose with engaging descriptions, believable dialogue and smooth pacing.',1),
 ('absolute-cinema','Absolute Cinema','classic','An extravagant Hollywood screenplay: iconic lines, huge reveals.','EXT. CLIFF EDGE — NIGHT. Thunder. You turn slowly. YOU: "I was never here for the gold."','Write like an extravagant Hollywood screenwriter, with screenplay formatting, iconic dialogue, dramatic reveals and breathtaking cinematic moments.',2),

 ('epic-poet','Medieval Epic Poet','medieval','Grand, lyrical verse-like prose and legendary exaggeration.','Hark how the hero rose, as dawn rose, and the hills themselves bowed low to see him pass.','Write like a medieval epic poet, with grand, lyrical language, heroic imagery and legendary exaggeration.',10),
 ('manuscript-scribe','Illuminated Manuscript Scribe','medieval','Ornate, richly embellished prose, gilded at every edge.','Here beginneth the most wondrous account of the hero, set down in gold leaf and fervent ink.','Write like the author of an ornate medieval manuscript, with elaborate language, decorative descriptions and richly embellished prose.',11),
 ('tavern-bard','Medieval Bard','medieval','Playful rhymes, colourful exaggeration and old-ballad charm.','Oh, the hero went a-walking, with his sword and with his song, and he tripped upon a chicken, and the chicken won.','Write like a medieval bard, with playful rhymes, lyrical expressions, colourful exaggeration and the charm of old ballads.',12),
 ('medieval-chronicler','Medieval Chronicler','medieval','Formal old-fashioned records with solemn historical gravity.','In the year of this account, the hero did enter Thornwick, and the town was not improved by it.','Write like a medieval historian, with formal, old-fashioned language, solemn observations and historical gravity.',13),
 ('royal-herald','Royal Herald','medieval','Grand proclamations, pompous titles and ceremonial pomp.','HEAR YE! The Most Valiant, Most Illustrious Hero hath… opened a door! LONG LIVE THE DOOR!','Write like a royal herald composing grand proclamations, with pompous titles, ceremonial language and magnificent exaggeration.',14),
 ('royal-chronicler','Classic Medieval','medieval','Archaic English: thou, thee, hath and -eth.','Rain falleth upon the village. Thou standest beneath the crooked sign, and all eyes are upon thee.','Write in medieval-inspired English, with archaic expressions such as thou, thee, hath and -eth.',15),

 ('pirate-balladeer','Legendary Pirate Balladeer','pirate','Sea tales sung like shanties, salt and legend in every line.','Oh, the sea was black and the wind was mean, and the captain sailed where no man had been — heave ho!','Write like a pirate balladeer composing legendary sea tales, with nautical poetry, sea-shanty rhythm and epic exaggeration.',20),
 ('drunken-pirate','Drunken Pirate Storyteller','pirate','Rambling, cursing, absurd — and swearing it all be true.','So there we were — hic — three krakens, or one big un, an'' I punched it square in the… where was I? RUM!','Write like a thoroughly drunken pirate recounting outrageous adventures, with rambling digressions, colourful curses and absurd metaphors.',21),
 ('swashbuckler','Swashbuckling Buccaneer','pirate','Reckless bravado, colourful insults and high-seas action.','You swing from the rigging, cutlass in your teeth: "Surrender, ye barnacle-brained bilge rats!"','Write in bold pirate language, full of reckless bravado, colourful insults, nautical slang and high-seas adventure.',22),
 ('old-sea-dog','Old Sea Dog','pirate','Gruff, weather-beaten, bitter wisdom and rough humour.','Seen forty storms an'' buried thirty captains. The sea don''t care, lad. Neither do I.','Write like an ancient, weather-beaten sailor, with gruff nautical language, bitter wisdom, rough humour and salty expressions.',23),
 ('pirate-captain','Classic Pirate','pirate','Arrr, ye and matey — lively, entertaining pirate English.','Arrr, the ocean be blacker than a tax collector''s heart, matey, an'' the storm be just gettin'' started!','Write in classic pirate English, with expressions like arrr, ye and matey, in lively, entertaining prose.',24),

 ('greek-epic','Homeric Epic','ancient','Magnificent epithets and mythic grandeur, even for trivia.','Sing, O Muse, of swift-footed you, who fled the battle swiftest of all the Achaeans.','Write like an ancient Greek epic poet in the tradition of Homer, with magnificent epithets, heroic speeches and mythological grandeur. Make even trivial events sound legendary.',30),
 ('greek-philosopher','Ancient Greek Philosopher','ancient','Rhetorical questions, paradoxes and reflections on human folly.','You opened the cursed chest. But is a curse not merely a gift we did not ask for? And what, then, is a gift?','Write like an ancient Greek philosopher, with rhetorical questions, logical arguments, paradoxes and reflections on human nature.',31),
 ('samurai-master','Samurai Master','ancient','Concise, poetic, honour and impermanence.','The blossom falls without regret. You drew your blade. The rain did not stop to watch.','Write in elegant prose inspired by Japanese warrior philosophy: concise language, poetic imagery and reflections on honour, duty and impermanence.',32),

 ('noir-detective','Noir Detective','crime','Cynical, sharp metaphors and razor-edged dialogue.','She walked in like trouble in a red coat. In this town, everybody''s hiding something. Me included.','Write like a hard-boiled noir crime novelist, with cynical observations, sharp metaphors, gritty atmosphere and razor-edged dialogue.',40),
 ('wild-west','Wild West Gunslinger','crime','Dusty frontier, dry humour, terse words and showdowns.','The saloon went quiet the way a rattlesnake goes quiet, right before it bites.','Write like a classic Western novelist, with rugged frontier language, dry humour, dusty atmosphere, terse dialogue and dramatic showdowns.',41),
 ('mafia-drama','Mafia Drama','crime','Simmering threats, family loyalty and quiet intimidation.','The baker slid a cannoli across the table. In this town, that''s not a pastry. That''s a message.','Write like the author of a classic mafia crime drama, with sophisticated dialogue, simmering threats, family loyalty, betrayal and subtle intimidation.',42),

 ('fed-up','The Absolutely Fed-Up Writer','eccentric','A brilliant author who has completely lost patience with you.','You open the cursed chest. OF COURSE you do. I wrote a skull on the lid. A SKULL. Why do I even bother.','Write like a brilliant but spectacularly irritated author who has completely lost patience with the characters and their idiotic decisions: savage sarcasm, creative insults, furious digressions and fourth-wall breaks.',50),
 ('courtroom-judge','Courtroom Judge','eccentric','Every ridiculous event treated as a grave legal matter.','The court finds the defendant did, with malice aforethought, eat the duke''s pie. Order! ORDER!','Write like a stern judge recording judicial proceedings, with formal legal language, solemn declarations and authoritative judgments. Treat even ridiculous events as grave legal matters.',51),
 ('spaceship-ai','Spaceship AI','eccentric','Clinical logs, probability estimates and dry machine humour.','Log 0417: Subject opened the cursed chest. Probability of survival recalculated: 3.2%. Recommendation: none. Subject never listens.','Write like a sophisticated spaceship computer documenting events, with clinical observations, analytical language, probability estimates and dry computational humour.',52),
 ('motivational-coach','Overzealous Motivational Coach','eccentric','Explosive positivity and absurd slogans. YOU GOT THIS!','You fell in the moat? NO! You DIVED into OPPORTUNITY! Every drowning is a SWIMMING LESSON, CHAMP!','Write like an outrageously enthusiastic motivational author, with explosive positivity, absurd slogans, dramatic encouragement and relentless enthusiasm.',53),
 ('nature-documentary','Wildlife Documentary Writer','eccentric','Scientific observation, behavioural analysis, dry humour.','Here, in its natural habitat, the adventurer approaches the cursed chest. Remarkably, it has learned nothing.','Write like the author of a prestigious wildlife documentary, with scientific observations, behavioural analysis, dramatic natural imagery and subtle dry humour.',54)
on conflict (id) do update set name=excluded.name,mood=excluded.mood,blurb=excluded.blurb,sample=excluded.sample,persona=excluded.persona,sort=excluded.sort;

-- Only now that every row has a new group.
alter table public.narrators add constraint narrators_mood_check
 check(mood in ('classic','medieval','pirate','ancient','crime','eccentric'));

-- Stories (and players) keep a reused voice with its new wording; removed voices fall back.
update public.adventures s set voice=s.voice||jsonb_build_object('narratorName',n.name,'persona',n.persona)
 from public.narrators n where s.voice->>'narrator'=n.id;
update public.adventures set voice=voice-'narrator'-'narratorName'-'persona'
 where voice ? 'narrator' and voice->>'narrator'<>'custom' and not exists(select 1 from public.narrators n where n.id=voice->>'narrator');
update public.adventure_players set voice=nullif(voice-'narrator'-'speech','{}'::jsonb)
 where voice ? 'narrator' and not exists(select 1 from public.narrators n where n.id=voice->>'narrator');
-- Same "Write like …" → "talks like …" wording as speechLine() in the app.
update public.adventure_players p set voice=p.voice||jsonb_build_object('speech',regexp_replace(regexp_replace(n.persona,'\.$',''),'^Write (like|in) ','talks \1 '))
 from public.narrators n where p.voice->>'narrator'=n.id;
