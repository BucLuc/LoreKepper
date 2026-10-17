-- New stories are set up step by step (party & AI, theme, quest, voice) before the lobby.
-- setup holds the wizard's progress so invited players watch it live; null means a story
-- made before the wizard (or saved from ChatGPT), which opens straight in the lobby.
alter table public.adventures add column setup jsonb check(setup is null or jsonb_typeof(setup)='object');
-- Which AI writes an API story: 'shared' (Lorekeeper's key) or one of the creator's own
-- provider keys. Null keeps the old behaviour: the creator's key, else the shared one.
alter table public.adventures add column ai_provider text check(ai_provider is null or ai_provider ~ '^[a-z]{2,20}$');

-- A key per provider, so the creator can pick which one writes a story.
alter table public.ai_settings drop constraint ai_settings_pkey;
alter table public.ai_settings add primary key(user_id,provider);
alter table public.ai_settings add column updated_at timestamptz not null default now();

-- Ready-made quests per theme (the narrators' moods). Edit or add rows in the table
-- editor. Players may reword one for their story; that copy lives only in the story.
create table public.worlds (
 id text primary key check(id ~ '^[a-z0-9-]{2,40}$'),
 theme text not null check(theme in ('classic','medieval','pirate','ancient','crime','eccentric')),
 title text not null check(length(title) between 1 and 80),
 pitch text not null check(length(pitch) between 1 and 200),
 -- What the narrator is told: a premise in a few plain sentences, as you'd type it.
 story text not null check(length(story) between 1 and 1500),
 sort integer not null default 0
);
alter table public.worlds enable row level security;
create policy worlds_read on public.worlds for select to anon, authenticated using (true);
grant select on public.worlds to anon, authenticated;
grant all on public.worlds to service_role;

insert into public.worlds(id,theme,title,pitch,story,sort) values
 ('dragons-rent','classic','The Dragon''s Rent','A kingdom owes a dragon a century of rent. Today it came to collect.','A small, broke kingdom has owed the dragon on the mountain a hundred years of rent, and this morning the dragon landed in the market square to collect. The king has appointed me to sort it out, mostly because I was standing closest.',1),
 ('opera-heist','classic','The Heist at the Grand Opera','A masked ball, a priceless crown and a crew of thieves who each think they''re in charge.','Opening night at the Grand Opera: a masked ball, a priceless crown on display and a crew of thieves who each believe they are the mastermind. The plan starts falling apart before the overture.',2),
 ('clockwork-city','classic','The Clockwork City','Every clock runs at its own speed, and someone has stolen tomorrow.','I wake up in a city of brass and steam where every clock runs at a different speed. Somebody has stolen tomorrow, and the city guard thinks it was me.',3),

 ('tournament-of-fools','medieval','The Tournament of Fools','Entered into the king''s tournament by mistake. Withdrawing is treason.','A clerical error has entered me into the king''s grand jousting tournament against the realm''s most fearsome knights. Withdrawing counts as treason. The first joust is at noon.',10),
 ('cursed-abbey','medieval','The Silent Abbey','Monks are vanishing one by one. The abbot insists all is well.','The monks of a remote mountain abbey are vanishing one by one, and the abbot insists everything is perfectly fine. A snowstorm has just closed the only road out.',11),
 ('heir-by-accident','medieval','Heir by Accident','The king choked on a grape. The crown now falls to you.','The king choked on a grape at breakfast, and after a long, absurd chain of succession the crown now belongs to me, a nobody. Half the court wants me crowned by sunset, the other half wants me dead.',12),

 ('one-eyed-mag','pirate','The Treasure of One-Eyed Mag','A half-burnt map, a cursed island and three rival crews.','A quest for the legendary hoard of One-Eyed Mag: I hold half of a burnt treasure map, the cursed island is three days'' sail away, and two rival crews want the map just as badly.',20),
 ('gallows-rescue','pirate','Saved from the Gallows','It starts at your hanging. Pirates crash it at the last second.','It starts at my own hanging in Port Royal, with the noose already around my neck. At the very last second a pirate crew crashes the execution and saves me, and now they expect me to join them.',21),
 ('merry-widow','pirate','Mutiny on the Merry Widow','The crew plots a mutiny. The captain wants you to find the ringleader.','Aboard the pirate ship Merry Widow, a mutiny is brewing. The captain has quietly ordered me to find the ringleader before the next full moon, and everyone on board carries a knife.',22),

 ('oracles-typo','ancient','The Oracle''s Typo','The Oracle says you''ll slay a god. She claims it''s a typo.','In ancient Greece, the Oracle of Delphi has foretold that I will slay a god. She swears it was a typo, but the gods of Olympus are not taking any chances.',30),
 ('jade-seal','ancient','The Jade Emperor''s Seal','The imperial seal vanished on the eve of the coronation.','In the imperial city, the Jade Seal has vanished on the eve of the coronation. Without it there is no emperor, and the palace has three days to find it before the generals choose their own.',31),
 ('falling-blossom','ancient','Ronin of the Falling Blossom','A masterless samurai, a village in debt and a contract nobody should take.','In feudal Japan, I am a masterless ronin with an empty purse. A poor village offers everything it has if I protect them from the bandits returning at the next full moon. The bandits outnumber us thirty to one.',32),

 ('midnight-express','crime','Murder on the Midnight Express','A body in first class, a snowstorm and nine suspects.','A luxury night train is stuck in a snowstorm. A wealthy passenger has been found dead in first class, there are nine suspects on board, and I am the only one who claims to be a detective.',40),
 ('dry-gulch','crime','The Last Saloon in Dry Gulch','The sheriff fled. The outlaw rides in at noon.','In the Wild West town of Dry Gulch, the sheriff fled at dawn and the most feared outlaw in the territory rides in at noon. By a vote of pure cowardice, the town has made me the new sheriff.',41),
 ('family-bakery','crime','The Family Bakery','You inherit your uncle''s bakery. It is not really a bakery.','My late uncle left me his bakery in Little Italy. It turns out the bakery is a front for the family business, the rival family wants the territory, and everyone keeps calling me Don.',42),

 ('colony-ship','eccentric','The Colony Ship','You wake up alone on a starship. The AI insists you''re the captain.','I wake up from cryosleep on a colony ship, the only crew member awake. The ship''s AI insists I am the captain, the real captain is missing, and something is knocking on the hull from the outside.',50),
 ('lost-quests','eccentric','The Office of Lost Quests','A bureaucracy for quests heroes never finished.','It is my first day at the Office of Lost Quests, a dusty bureaucracy for every quest a hero abandoned halfway. My first case file: a dragon that has been waiting to be slain for forty years and is getting impatient.',51),
 ('dungeon-reality','eccentric','Dungeon: The Reality Show','A medieval reality show. The dungeon is real. So are the ratings.','I am a contestant on a medieval reality show where adventurers compete to survive a real dungeon. The audience votes on traps, the host is a lich with a microphone, and the ratings are everything.',52)
on conflict (id) do update set theme=excluded.theme,title=excluded.title,pitch=excluded.pitch,story=excluded.story,sort=excluded.sort;

-- Once the first chapter exists, only the display can change: story, voice and AI stay.
create or replace function public.configure_adventure(a uuid,u uuid,r integer,settings jsonb,casts jsonb) returns void language plpgsql set search_path=public as $$declare s adventures;item jsonb;started boolean;begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.generating_until>now()
  or (s.status not in ('lobby','paused','completed') and not (s.status='active' and s.ai_mode='chatgpt' and s.draft is null))
 then raise exception 'Only the creator can edit an idle lobby'; end if;
 if s.revision<>r then raise exception 'Lobby changed. Reload before saving'; end if;
 if jsonb_typeof(casts)<>'array' then raise exception 'Invalid players'; end if;
 for item in select * from jsonb_array_elements(casts) loop
  update adventure_players set identity_name=left(coalesce(trim(item->>'name'),''),100),description=left(coalesce(item->>'description',''),2000),
   voice=case when jsonb_typeof(item->'voice')='object' then item->'voice' end,character=null
  where adventure_id=a and user_id=(item->>'user')::uuid;
  if not found then raise exception 'Unknown player'; end if;
 end loop;
 started=jsonb_array_length(s.segments)>0 or s.draft is not null;
 update adventures set edition=settings->>'edition',design=settings->'design',revision=revision+1,
  title=case when started then title else coalesce(settings->>'title',title) end,
  world=case when started then world else coalesce(settings->>'world',world) end,
  voice=case when started then voice else coalesce(settings->'voice',voice) end,
  ai_mode=case when started then ai_mode else coalesce(settings->>'ai_mode','api') end,
  ai_provider=case when started or not settings ? 'ai_provider' then ai_provider else settings->>'ai_provider' end,
  setup=case when started or not settings ? 'setup' then setup else nullif(settings->'setup','null'::jsonb) end
 where id=a;
end $$;
