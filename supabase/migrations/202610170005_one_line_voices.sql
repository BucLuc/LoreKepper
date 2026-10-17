-- Voices as one plain line, the way you'd type it to ChatGPT. Longer descriptions
-- made it follow rules instead of simply playing.
update public.narrators n set persona=v.persona from (values
 ('classic-fantasy','Write like a classic fantasy novel.'),
 ('light-witty','Write in a light, witty, playful way.'),
 ('dark-gritty','Write in a dark, gritty way.'),
 ('pirate-captain','Write like a pirate captain.'),
 ('unhinged-pirate','Write like an unhinged pirate.'),
 ('posh-pirate','Write like an absurdly posh pirate.'),
 ('pirate-shakespeare','Write like Shakespeare if he were a drunk pirate.'),
 ('royal-chronicler','Write like a mock-epic medieval chronicle in King James English (thou, hath), telling every absurd thing I do with total epic gravity.'),
 ('tavern-bard','Write like a wildly overdramatic medieval bard.'),
 ('grumpy-dwarf','Write like a grumpy old dwarf.'),
 ('royal-herald','Write like a pompous royal herald.'),
 ('sports-commentator','Write like a sports commentator at a medieval tournament.'),
 ('nature-documentary','Write like a nature documentary narrator.'),
 ('genz-bard','Write like a medieval bard who talks like a Gen-Z teenager.'),
 ('soap-opera','Write like a dramatic soap opera.'),
 ('angry-chef','Write like a furious TV chef.'),
 ('campfire','Write like a campfire horror story.'),
 ('noir-detective','Write like a hard-boiled noir detective story.'),
 ('bedtime-grandparent','Write like a cozy fairy tale.'),
 ('anime-announcer','Write like an over-the-top shōnen anime.'),
 ('conspiracy','Write like a paranoid conspiracy theorist.')
) as v(id,persona) where n.id=v.id;

update public.adventures s set voice=s.voice||jsonb_build_object('persona',n.persona)
 from public.narrators n where s.voice->>'narrator'=n.id;
