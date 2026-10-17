-- "Unhinged" describes the narration, not the world: the story itself stays a normal
-- pirate adventure.
update public.narrators set persona='Write like a completely over-the-top, unhinged pirate captain narrating: ARRR in every other line, outrageous boasts, sea oaths, rum and CAPS, pirate-ness turned up to eleven. Only the narration is unhinged; the world and story stay a normal pirate adventure.'
 where id='unhinged-pirate';
update public.adventures s set voice=s.voice||jsonb_build_object('persona',n.persona)
 from public.narrators n where n.id='unhinged-pirate' and s.voice->>'narrator'=n.id;
