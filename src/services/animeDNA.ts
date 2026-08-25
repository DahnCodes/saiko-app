import type { Anime } from '../types/anime.ts'
export type AnimeDNATrait = { name: string; score: number; icon: string }
export type AnimeDNA = { userId: string; archetype: { id: string; name: string; description: string; icon: string }; description: string; traits: AnimeDNATrait[]; favoriteAnime: Anime[]; version: number; generatedAt: string }
const traitMeta = [['Action','⚔️'],['Adventure','🌍'],['Comedy','☀️'],['Romance','💞'],['Drama','🎭'],['Fantasy','✨'],['Sci-Fi','🚀'],['Supernatural','🌑'],['Psychological','🧠'],['Horror','🕯️'],['Sports','🏆'],['Mystery','🔎'],['Thriller','⚡'],['Slice of Life','🌿']] as const
type Archetype = { id:string; name:string; icon:string; description:string; signals:string[] }
const archetypes: Archetype[] = [
 {id:'shonen-warrior',name:'THE SHONEN WARRIOR',icon:'⚔️',description:'You chase rivalries, hard-earned victories and heroes who refuse to stay down.',signals:['Action','Adventure']},
 {id:'dark-story-hunter',name:'THE DARK STORY HUNTER',icon:'🌑',description:'You gravitate toward worlds where every victory has a cost and every answer raises a darker question.',signals:['Drama','Thriller','Horror','Psychological']},
 {id:'dream-chasing-hero',name:'THE DREAM-CHASING HERO',icon:'🌟',description:'You love hopeful heroes, loyal crews and impossible dreams that become bigger than the person who started them.',signals:['Action','Adventure','Comedy']},
 {id:'blade-seeker',name:'THE BLADE SEEKER',icon:'🗡️',description:'You are drawn to disciplined fighters, supernatural danger and emotional battles fought one step at a time.',signals:['Action','Supernatural','Drama']},
 {id:'chaos-adventurer',name:'THE CHAOS ADVENTURER',icon:'🌊',description:'You want unpredictable worlds, ridiculous moments, unforgettable characters and an adventure that never stops moving.',signals:['Adventure','Comedy','Fantasy']},
 {id:'world-builder',name:'THE FANTASY EXPLORER',icon:'✨',description:'You fall into rich mythology, imaginative worlds and stories that reward deep exploration.',signals:['Fantasy','Sci-Fi','Supernatural']},
 {id:'emotional-warrior',name:'THE EMOTIONAL WARRIOR',icon:'💞',description:'You stay for character growth, fierce bonds and the feelings beneath every spectacular fight.',signals:['Drama','Romance','Slice of Life']},
 {id:'shadow-strategist',name:'THE CHAOS STRATEGIST',icon:'🧠',description:'You enjoy layered conflicts, clever turns and characters who win as much with their minds as their power.',signals:['Psychological','Mystery','Thriller']},
 {id:'survivor',name:'THE LAST SURVIVOR',icon:'🛡️',description:'You seek stories of endurance, sacrifice and people who keep moving when the world has already broken them.',signals:['Action','Drama','Horror']},
]
const normalize = (value:string) => value.toLowerCase().replace(/[^a-z0-9]/g,'')
export function calculateAnimeDNA(userId:string, favorites:Anime[]):AnimeDNA {
 const counts = new Map<string,number>(); favorites.forEach(a=>a.genres.forEach(g=>counts.set(g,(counts.get(g)??0)+1)))
 const max = Math.max(...counts.values(),1)
 const dnaTraits = traitMeta.map(([name,icon])=>({name,icon,score:Math.round(((counts.get(name)??0)/max)*100)})).filter(t=>t.score>0).sort((a,b)=>b.score-a.score).slice(0,8)
 const signature = favorites.map(a=>normalize(a.title)).sort().join('|')
 const hash = [...signature].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7)
 const scored = archetypes.map((a,index)=>({a,index,score:a.signals.reduce((sum,s)=>sum+(counts.get(s)??0),0)})).sort((x,y)=>y.score-x.score || ((hash+y.index)%archetypes.length)-((hash+x.index)%archetypes.length))
 const archetype = (scored[0]?.score ?? 0)>0 ? scored[0].a : archetypes[hash%archetypes.length]
 return {userId,archetype,description:archetype.description,traits:dnaTraits,favoriteAnime:favorites,version:2,generatedAt:new Date().toISOString()}
}
