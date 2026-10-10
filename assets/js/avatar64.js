/* Atelier 64, extrait TEL QUEL de avatar64.html par extraire.py.
 *
 * Rendu : atelier64-v7 | graine : atelier64-v4
 *
 * Ne rien modifier ici : relancer extraire.py. La moindre retouche ferait diverger les
 * creatures de celles que la page produit.
 */
/* Atelier 64 · génération procédurale déterministe · aucune dépendance */
const Avatar64 = (() => {
  'use strict';
  const SIZE=64, PIVOT={x:32,y:60}, VERSION='atelier64-v7', SEED_VERSION='atelier64-v4';
  const DIRECTIONS=['front','back','right'];
  const SPECIES={human:'Humain',fox:'Renard',rabbit:'Lapin',dragon:'Dragon',golem:'Golem',robot:'Automate',ghost:'Esprit',mushroom:'Mycélien',cat:'Félin',imp:'Diablotin',avian:'Oisillon',aquatic:'Aquatique',cephalopod:'Céphalopode'};
  const WORLDS={cosmic:'Cosmique',woodland:'Forêt enchantée',arcane:'Arcanique',neon:'Néon urbain',copper:'Mécanique rétro',frost:'Terres de givre'};
  const GEAR={blaster:'Blaster',bazooka:'Lance-étoiles',flag:'Étendard',jetpack:'Réacteurs dorsaux',orb:'Orbe stellaire',gauntlets:'Poings géants',hammer:'Marteau de titan',wraps:'Poings bandés',spear:'Lance rituelle',scarf:'Longue écharpe',parcel:'Colis de messager',compass:'Boussole géante',sword:'Épée d’aventure',book:'Grimoire ouvert',crystal:'Cristal flottant',lantern:'Lanterne magique',key:'Clé monumentale',ball:'Ballon',trophy:'Trophée',bat:'Batte',wrench:'Clé mécanique',springs:'Réacteur à ressorts',scythe:'Faux lunaire',skull:'Totem crâne',staff:'Bâton arcanique',cannon:'Canon à impulsion',shield:'Bouclier'};
  Object.assign(GEAR,{rifle:'Fusil laser',gloves:'Gants de boxe',bo:'Bâton de combat',hook:'Grappin',torch:'Torche',racket:'Raquette',puzzlebox:'Cubes d’énigme',flippers:'Palettes de flipper',chromeorb:'Bille de flipper',bow:'Arc'});
  const LIMBS={boots:'bottes',paws:'pattes',claws:'griffes',hooves:'sabots',talons:'serres',spring:'ressorts',tentacles:'tentacules',hover:'lévitation',fluke:'nageoire caudale'};
  const APPENDAGES={arms:'bras',wings:'ailes',fins:'nageoires',tentacles:'tentacules latéraux'};
  const CAPES={none:'sans cape',short:'cape courte',royal:'grande cape',split:'cape fendue',ragged:'cape déchirée'};
  // Morphologies originales : proportions, rythme et lecture de silhouette sont
  // recombinés ; aucune ligne ne reproduit le costume d'une référence existante.
  const MORPHS=[
    {id:'puck',name:'Puck',body:'round',bw:9,hw:12,hh:9,legs:8,torso:13,head:1.25,species:['cat','mushroom','human'],reach:5,gait:'bounce'},
    {id:'veloce',name:'Véloce',body:'pear',bw:8,hw:11,hh:8.5,legs:10,torso:12,head:1.2,species:['rabbit','fox'],reach:6,gait:'spring'},
    {id:'halo',name:'Halo',body:'round',bw:11,hw:12,hh:9,legs:8,torso:14,head:1.2,species:['ghost','cephalopod'],reach:5,gait:'float'},
    {id:'bastion',name:'Bastion',body:'square',bw:10,hw:12,hh:9,legs:9,torso:15,head:1.2,species:['robot','golem'],reach:5,gait:'heavy'},
    {id:'sylve',name:'Sylve',body:'taper',bw:8,hw:12,hh:9,legs:10,torso:13,head:1.2,species:['imp','human'],reach:6,gait:'light'},
    {id:'bront',name:'Bront',body:'pear',bw:11,hw:12,hh:9,legs:8,torso:15,head:1.2,species:['golem','dragon'],reach:5,gait:'heavy'},
    {id:'moko',name:'Moko',body:'pear',bw:10,hw:12,hh:9,legs:8,torso:13,head:1.25,species:['dragon','cat'],reach:5,gait:'bounce'},
    {id:'voltige',name:'Voltige',body:'round',bw:8,hw:11,hh:9,legs:8,torso:13,head:1.2,species:['avian'],reach:6,gait:'spring'},
    {id:'roc',name:'Roc',body:'taper',bw:9,hw:12,hh:9,legs:10,torso:14,head:1.2,species:['human','golem'],reach:5,gait:'heavy'},
    {id:'nyra',name:'Nyra',body:'pear',bw:8,hw:12,hh:9,legs:10,torso:12,head:1.2,species:['human','cat'],reach:6,gait:'light'},
    {id:'noct',name:'Noct',body:'round',bw:9,hw:12,hh:9,legs:8,torso:13,head:1.2,species:['ghost','imp'],reach:6,gait:'float'},
    {id:'tala',name:'Tala',body:'taper',bw:8,hw:12,hh:9,legs:10,torso:13,head:1.2,species:['fox','human'],reach:6,gait:'light'},
    {id:'zigo',name:'Zigo',body:'pear',bw:9,hw:12,hh:9,legs:8,torso:13,head:1.2,species:['avian','dragon'],reach:6,gait:'spring'},
    {id:'drume',name:'Drume',body:'shell',bw:11,hw:12,hh:9,legs:8,torso:14,head:1.2,species:['dragon','mushroom'],reach:5,gait:'heavy'},
    {id:'flottin',name:'Flottin',body:'round',bw:10,hw:12,hh:9,legs:8,torso:13,head:1.2,species:['aquatic'],reach:6,gait:'float'},
    {id:'ruban',name:'Ruban',body:'round',bw:9,hw:12,hh:9,legs:9,torso:13,head:1.25,species:['cephalopod'],reach:6,gait:'float'},
    {id:'cube',name:'Cube',body:'square',bw:9,hw:12,hh:9,legs:9,torso:13,head:1.25,species:['robot','golem'],reach:5,gait:'bounce'},
    {id:'orbe',name:'Orbe',body:'pear',bw:10,hw:13,hh:9,legs:8,torso:12,head:1.25,species:['mushroom','aquatic'],reach:5,gait:'bounce'},
    {id:'luma',name:'Luma',body:'pear',bw:8,hw:11.5,hh:9,legs:10,torso:12,head:1.2,species:['cat','rabbit','human'],reach:6,gait:'light'},
    {id:'kro',name:'Kro',body:'shell',bw:11,hw:12,hh:9,legs:8,torso:14,head:1.2,species:['aquatic','dragon'],reach:5,gait:'heavy'}
  ];
  const THEMES={
    'run-and-gun':{hues:[24,142,206],cape:['none','short'],off:['none','shield'],trim:'metal'},
    shmup:{hues:[197,257,318],cape:['none','short'],off:['none','orb'],trim:'glow'},
    beatemup:{hues:[7,32,278],cape:['none','short'],off:['none'],trim:'accent'},
    fighting:{hues:[12,171,292],cape:['none','split'],off:['none'],trim:'accent'},
    racing:{hues:[28,185,326],cape:['none','short'],off:['none'],trim:'glow'},
    platformer:{hues:[42,155,211],cape:['none','short'],off:['none','shield'],trim:'accent'},
    puzzle:{hues:[43,176,271],cape:['short','royal'],off:['none','orb'],trim:'metal'},
    maze:{hues:[168,229,280],cape:['short','split'],off:['none','orb'],trim:'glow'},
    sports:{hues:[11,211,278],cape:['none'],off:['none'],trim:'white'},
    pinball:{hues:[28,187,318],cape:['none','short'],off:['none','orb'],trim:'metal'},
    horror:{hues:[165,268,347],cape:['royal','ragged','split'],off:['none','orb'],trim:'glow'},
    rpg:{hues:[36,159,266],cape:['royal','split'],off:['none','shield','orb'],trim:'metal'},
    shooter:{hues:[16,199,258],cape:['none','short'],off:['none','shield'],trim:'glow'}
  };
  const GEAR_POOLS={ranger:['blaster','bazooka','flag'],pilot:['jetpack','orb','blaster'],brawler:['gauntlets','hammer','gauntlets'],monk:['wraps','spear','gauntlets'],runner:['scarf','parcel','flag'],scout:['compass','sword','flag'],sage:['book','crystal','key'],wanderer:['lantern','key','crystal'],athlete:['ball','trophy','bat'],tinker:['wrench','springs','hammer'],nightling:['scythe','skull','lantern'],mage:['staff','book','crystal'],sentinel:['cannon','shield','bazooka']};
  const FAMILIES={
    'run-and-gun':{label:'Run and gun',title:'Éclaireur intrépide',role:'ranger',species:['human','fox','dragon','robot'],worlds:['neon','copper','frost'],gear:'pack',hat:'helmet'},
    shmup:{label:'Shoot ’em up',title:'Voyageur des étoiles',role:'pilot',species:['cat','rabbit','dragon','robot','imp'],worlds:['cosmic','neon'],gear:'jetpack',hat:'goggles'},
    beatemup:{label:'Beat ’em up',title:'Colosse des rues',role:'brawler',species:['golem','human','fox','imp','cat'],worlds:['neon','copper'],gear:'gauntlets',hat:'crest'},
    fighting:{label:'Combat / versus',title:'Duelliste des éléments',role:'monk',species:['human','rabbit','dragon','cat','imp'],worlds:['arcane','frost','neon'],gear:'wraps',hat:'bandana'},
    racing:{label:'Course',title:'Messager à toute vitesse',role:'runner',species:['fox','rabbit','cat','robot'],worlds:['neon','copper','cosmic'],gear:'scarf',hat:'goggles'},
    platformer:{label:'Plateforme',title:'Petit explorateur',role:'scout',species:['fox','rabbit','mushroom','cat','imp'],worlds:['woodland','arcane','frost'],gear:'pack',hat:'cap'},
    puzzle:{label:'Puzzle / réflexion',title:'Gardien des énigmes',role:'sage',species:['golem','mushroom','robot','human'],worlds:['arcane','copper','woodland'],gear:'book',hat:'spectacles'},
    maze:{label:'Labyrinthe',title:'Éclaireur du crépuscule',role:'wanderer',species:['ghost','imp','cat','mushroom'],worlds:['arcane','woodland','cosmic'],gear:'lantern',hat:'hood'},
    sports:{label:'Sport',title:'Champion bondissant',role:'athlete',species:['rabbit','human','fox','cat','golem'],worlds:['neon','frost','woodland'],gear:'ball',hat:'headband'},
    pinball:{label:'Flipper',title:'Automate à ressorts',role:'tinker',species:['robot','golem','imp'],worlds:['copper','neon','cosmic'],gear:'springs',hat:'antenna'},
    horror:{label:'Horreur',title:'Créature de la nuit',role:'nightling',species:['ghost','imp','cat','human','fox'],worlds:['arcane','frost','neon'],gear:'cape',hat:'collar'},
    rpg:{label:'Jeu de rôle',title:'Compagnon des arcanes',role:'mage',species:['human','imp','dragon','mushroom','rabbit'],worlds:['arcane','woodland','frost'],gear:'staff',hat:'wizard'},
    shooter:{label:'Tir',title:'Sentinelle des frontières',role:'sentinel',species:['robot','dragon','human','golem'],worlds:['cosmic','neon','copper'],gear:'cannon',hat:'visor'}
  };
  const HATS={combat:'Casque de commando',robot:'Casque robot',space:'Casque spatial',aviator:'Casque d’aviateur',moto:'Casque intégral',racer:'Casque de course',cap:'Casquette',beanie:'Bonnet urbain',bandana:'Bandana',straw:'Chapeau de paille',beret:'Béret',scholar:'Chapeau d’érudit',miner:'Casque à lampe',hood:'Capuche',sport:'Casque de sport',antenna:'Casque à antenne',tophat:'Haut-de-forme',witch:'Chapeau de sorcière',wizard:'Chapeau de mage',knight:'Casque de chevalier'};
  const BACKS={none:'Sans sac',ammo:'Sac de munitions',battery:'Batterie dorsale',jetpack:'Réacteurs dorsaux',satchel:'Sac en bandoulière',backpack:'Sac à dos d’aventure',bedroll:'Sac avec couchage',toolbox:'Sacoche à outils',books:'Sac de grimoires',quiver:'Carquois',springs:'Mécanisme à ressorts',duffel:'Sac de sport'};
  const LOADOUTS={
    'run-and-gun':[
      {name:'Commando laser',gear:'blaster',hat:'combat',back:'ammo',costume:'armor'},
      {name:'Artilleur mobile',gear:'bazooka',hat:'combat',back:'battery',costume:'armor'},
      {name:'Ranger plasma',gear:'rifle',hat:'combat',back:'ammo',costume:'armor'}],
    shmup:[
      {name:'Pilote stellaire',gear:'blaster',hat:'space',back:'jetpack',costume:'flight'},
      {name:'As des étoiles',gear:'cannon',hat:'aviator',back:'jetpack',costume:'flight'},
      {name:'Éclaireur orbital',gear:'orb',hat:'space',back:'battery',costume:'flight'}],
    beatemup:[
      {name:'Boxeur des rues',gear:'gloves',hat:'beanie',back:'none',costume:'jacket'},
      {name:'Cogneur du quartier',gear:'bat',hat:'cap',back:'satchel',costume:'jacket'},
      {name:'Poings d’acier',gear:'gauntlets',hat:'bandana',back:'none',costume:'jacket'}],
    fighting:[
      {name:'Disciple du dojo',gear:'wraps',hat:'bandana',back:'none',costume:'gi'},
      {name:'Maître du bâton',gear:'bo',hat:'straw',back:'bedroll',costume:'gi'},
      {name:'Champion du tournoi',gear:'gauntlets',hat:'bandana',back:'none',costume:'gi'}],
    racing:[
      {name:'Pilote de moto',gear:'scarf',hat:'moto',back:'toolbox',costume:'racing',cape:'none'},
      {name:'As du circuit',gear:'flag',hat:'racer',back:'none',costume:'racing',cape:'none'},
      {name:'Mécano des stands',gear:'wrench',hat:'moto',back:'toolbox',costume:'racing',cape:'none'}],
    platformer:[
      {name:'Aventurier des collines',gear:'sword',offhand:'shield',hat:'cap',back:'backpack',costume:'overalls'},
      {name:'Explorateur des sommets',gear:'hook',hat:'miner',back:'bedroll',costume:'overalls'},
      {name:'Messager des mondes',gear:'compass',hat:'beret',back:'satchel',costume:'overalls'}],
    puzzle:[
      {name:'Alchimiste des cubes',gear:'puzzlebox',hat:'scholar',back:'books',costume:'scholar'},
      {name:'Gardien des clés',gear:'key',hat:'beret',back:'satchel',costume:'scholar'},
      {name:'Érudit des énigmes',gear:'book',hat:'scholar',back:'books',costume:'scholar'}],
    maze:[
      {name:'Guide des souterrains',gear:'lantern',hat:'miner',back:'backpack',costume:'explorer'},
      {name:'Éclaireur des labyrinthes',gear:'torch',hat:'hood',back:'satchel',costume:'explorer'},
      {name:'Gardien des passages',gear:'key',hat:'hood',back:'bedroll',costume:'explorer'}],
    sports:[
      {name:'Champion du terrain',gear:'ball',hat:'sport',back:'none',costume:'sports',cape:'none'},
      {name:'Batteur vedette',gear:'bat',hat:'cap',back:'duffel',costume:'sports',cape:'none'},
      {name:'As de la raquette',gear:'racket',hat:'cap',back:'duffel',costume:'sports',cape:'none'}],
    pinball:[
      {name:'Maître des flippers',gear:'flippers',hat:'antenna',back:'springs',costume:'machine'},
      {name:'Gardien des bumpers',gear:'chromeorb',hat:'robot',back:'springs',costume:'machine'},
      {name:'Mécanicien du jackpot',gear:'wrench',hat:'antenna',back:'springs',costume:'machine'}],
    horror:[
      {name:'Veilleur de minuit',gear:'lantern',hat:'tophat',back:'books',costume:'gothic',cape:'ragged'},
      {name:'Faucheur de brume',gear:'scythe',hat:'hood',back:'none',costume:'gothic',cape:'ragged'},
      {name:'Apprenti des ombres',gear:'skull',hat:'witch',back:'satchel',costume:'gothic',cape:'royal'}],
    rpg:[
      {name:'Mage des cristaux',gear:'staff',offhand:'book',hat:'wizard',back:'books',costume:'robe',cape:'royal'},
      {name:'Chevalier errant',gear:'sword',offhand:'shield',hat:'knight',back:'bedroll',costume:'armor',cape:'royal'},
      {name:'Archer des forêts',gear:'bow',hat:'hood',back:'quiver',costume:'explorer',cape:'split'}],
    shooter:[
      {name:'Sentinelle mécanique',gear:'cannon',hat:'robot',back:'battery',costume:'armor'},
      {name:'Éclaireur laser',gear:'rifle',hat:'robot',back:'ammo',costume:'armor'},
      {name:'Gardien plasma',gear:'blaster',offhand:'shield',hat:'space',back:'battery',costume:'armor'}]
  };

  // Données reprises du référentiel du projet, ordre de priorité conservé.
  const GENRE_MAP=[
  {
    "slug": "run-and-gun",
    "ids": [
      "3026"
    ],
    "labels": [
      "run and gun",
      "run'n gun"
    ]
  },
  {
    "slug": "shmup",
    "ids": [
      "79",
      "2851",
      "2870",
      "2955"
    ],
    "labels": [
      "shoot'em up",
      "shootem up",
      "shmup"
    ]
  },
  {
    "slug": "beatemup",
    "ids": [
      "1"
    ],
    "labels": [
      "beat'em up",
      "beatem up",
      "beat 'em"
    ]
  },
  {
    "slug": "fighting",
    "ids": [
      "14",
      "3034",
      "2885"
    ],
    "labels": [
      "fighting",
      "combat",
      "versus"
    ]
  },
  {
    "slug": "racing",
    "ids": [
      "28"
    ],
    "labels": [
      "racing",
      "course",
      "driving",
      "conduite"
    ]
  },
  {
    "slug": "platformer",
    "ids": [
      "7",
      "2887",
      "2896"
    ],
    "labels": [
      "platform",
      "plateforme"
    ]
  },
  {
    "slug": "puzzle",
    "ids": [
      "26",
      "2864",
      "2891"
    ],
    "labels": [
      "puzzle",
      "reflexion"
    ]
  },
  {
    "slug": "maze",
    "ids": [
      "2937"
    ],
    "labels": [
      "labyrinth",
      "labyrinthe",
      "maze"
    ]
  },
  {
    "slug": "sports",
    "ids": [
      "685",
      "2846",
      "2852",
      "2853",
      "2861",
      "2875",
      "2901",
      "2913",
      "3028"
    ],
    "labels": [
      "sports",
      "sport"
    ]
  },
  {
    "slug": "pinball",
    "ids": [
      "2954"
    ],
    "labels": [
      "pinball",
      "flipper"
    ]
  },
  {
    "slug": "horror",
    "ids": [
      "20680"
    ],
    "labels": [
      "survival horror",
      "horreur"
    ]
  },
  {
    "slug": "rpg",
    "ids": [
      "8"
    ],
    "labels": [
      "role playing",
      "jeu de role",
      "rpg"
    ]
  },
  {
    "slug": "shooter",
    "ids": [
      "2646"
    ],
    "labels": [
      "shooter",
      "tir"
    ]
  }
]
;
  const SOURCE={url:'https://github.com/Nelfe80/RetroBat-Marquee-Manager/blob/80b9a26e0645e265ffc109ace0374d6e0d55fe18/Resources/lighting/genres.map.xml',revision:'80b9a26e0645e265ffc109ace0374d6e0d55fe18'};
  function hash(s){
    let a=1779033703,b=3144134277,c=1013904242,d=2773480762;
    for(let i=0;i<s.length;i++){const k=s.charCodeAt(i);a=b^Math.imul(a^k,597399067);b=c^Math.imul(b^k,2869860233);c=d^Math.imul(c^k,951274213);d=a^Math.imul(d^k,2716044179);}
    a=Math.imul(c^(a>>>18),597399067);b=Math.imul(d^(b>>>22),2869860233);c=Math.imul(a^(c>>>17),951274213);d=Math.imul(b^(d>>>19),2716044179);
    return [(a^b^c^d)>>>0,(b^a)>>>0,(c^a)>>>0,(d^a)>>>0];
  }
  function random(seed){let[a,b,c,d]=seed;return()=>{a>>>=0;b>>>=0;c>>>=0;d>>>=0;let t=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;t=(t+d)|0;c=(c+t)|0;return(t>>>0)/4294967296;};}
  function normalizePseudo(s){if(typeof s!=='string')throw new TypeError('Le pseudo doit être du texte.');const t=s.normalize('NFC').trim();if(!t)throw new RangeError('Entre un pseudo pour créer ton avatar.');return t;}
  function hsl(h,s,l){s/=100;l/=100;h=(h%360+360)%360;const a=s*Math.min(l,1-l);return '#'+[0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round((l-a*Math.max(-1,Math.min(k-3,9-k,1)))*255).toString(16).padStart(2,'0');}).join('');}
  function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
  function tint(hex,f){return '#'+rgb(hex).map(c=>Math.min(255,Math.max(0,Math.round(f<1?c*f:c+(255-c)*(f-1)))) .toString(16).padStart(2,'0')).join('');}
  function toHSL(hex){
    const [r,g,b]=rgb(hex).map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
    const h=d===0?0:max===r?60*(((g-b)/d+6)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
    return [h,d===0?0:100*d/(1-Math.abs(2*l-1)),l*100];
  }
  function mixColor(a,b,t){const aa=rgb(a),bb=rgb(b);return '#'+aa.map((v,i)=>Math.round(v*(1-t)+bb[i]*t).toString(16).padStart(2,'0')).join('');}
  function vividSkin(hex,species){
    const [h,s,l]=toHSL(hex);
    if(species==='human')return hsl(h,Math.min(74,s+9),l);
    return hsl(h,Math.max(species==='robot'?60:76,Math.min(94,s+22)),Math.max(53,Math.min(67,l)));
  }
  function colorRamp(hex,name){
    const [h,s,l]=toHSL(hex),turn=((265-h+540)%360)-180;
    if(name==='dark')return ['#130b30','#1c1044',hex,'#4b357a','#7d71b1','#b3baff'];
    return [hsl(h+turn*.34,Math.max(66,s),l*.43),hsl(h+turn*.13,Math.max(68,s),l*.72),hex,
      mixColor(hex,'#ffe6ff',.30),mixColor(hex,'#def7ff',.64),'#fff9ff'];
  }
  function generate(value,options={}){
    const pseudo=normalizePseudo(value),family=options.family??'platformer',variation=options.variation??0;
    if(!Object.hasOwn(FAMILIES,family))throw new RangeError('Famille inconnue.');
    if(!Number.isSafeInteger(variation)||variation<0||variation>9999)throw new RangeError('La variation doit être un entier entre 0 et 9999.');
    // ADN du joueur indépendant des jeux : changer de thème ne change pas son corps.
    const r=random(hash(SEED_VERSION+':body:'+pseudo+':'+variation)),pick=a=>a[Math.floor(r()*a.length)];
    const morph=MORPHS[(hash(pseudo)[0]+variation)%MORPHS.length];
    const species=pick(morph.species),mutation=r();
    const eyes=mutation>.94?pick([3,4]):mutation<.07?1:2;
    const appendageType=species==='avian'?'wings':species==='aquatic'?'fins':
      ['ghost','cephalopod'].includes(species)?'tentacles':
      species==='dragon'?pick(['arms','arms','wings']):species==='imp'?pick(['arms','arms','wings']):'arms';
    const appendageCount=appendageType==='tentacles'?4:2;
    const limbType=species==='aquatic'?'fluke':['ghost','cephalopod'].includes(species)?'tentacles':
      species==='avian'?'talons':species==='robot'?pick(['boots','spring']):
      species==='human'?'boots':pick(['boots','paws','paws','hooves']);
    const armCount=appendageType==='arms'?2:0;
    const earCount=['avian','aquatic','cephalopod','ghost','robot','golem','mushroom'].includes(species)?0:
      ['rabbit','fox','cat','human'].includes(species)?2:pick([0,2]);
    const identity={morph:morph.id,morphName:morph.name,species,bodyShape:morph.body,
      legHeight:morph.legs,torsoHeight:morph.torso,headScale:morph.head,gait:morph.gait,
      appendageType,appendageCount,armCount,detachedArms:false,armReach:morph.reach,
      bodyWidth:morph.bw+pick([-.5,0,.5]),bodyDepth:morph.body==='shell'?6:5,
      headWidth:morph.hw+pick([-.5,0,.5]),headDepth:8,headHeight:morph.hh,
      earLength:pick([4,5,6]),eyeStyle:pick(['round','round','bright','serious']),eyeCount:eyes,
      hornCount:pick(['dragon','imp'].includes(species)?[0,1,2,2,4]:species==='golem'?[0,0,2]:[0]),
      hornType:pick(['straight','curved']),earCount,
      earType:species==='human'?'round':species==='rabbit'?'long':pick(['pointed','round']),
      limbType,handType:species==='robot'?'mech':pick(['mittens','mittens','claws']),
      legCount:limbType==='fluke'?0:limbType==='tentacles'?4:2,
      tailLength:9+Math.floor(r()*3),crest:Math.floor(r()*3),bootSize:4,
      asymmetry:r()>.5?1:-1,winged:appendageType==='wings'};
    const skinPalettes={human:['#edbd8f','#d69c6b','#b87950','#8f5b40'],fox:['#ec9843','#deb569','#c4d9df'],rabbit:['#e8d8be','#bfabe0','#a8cbd4'],
      cat:['#e4aa56','#aca8c2','#d2bb9a'],dragon:['#63b96f','#43b9b3','#d9894d'],golem:['#8f9d91','#b69e79','#91a9b2'],
      robot:['#a5bec3','#d8b85e','#bc9aa8'],ghost:['#cce3e0','#c7bfdc','#e3d9bb'],mushroom:['#e9c79c','#bdd28c','#e4bbaa'],
      imp:['#c18cbd','#82b688','#d78165'],avian:['#e4bd53','#73b2d4','#db8868'],aquatic:['#61b8c9','#95c570','#d993b4'],cephalopod:['#b29bdd','#df9b82','#68bdaa']};
    const skin=vividSkin(pick(skinPalettes[species]),species),hair=species==='avian'?'#e9a04c':pick(['#513e38','#855336','#c48a43','#dfd2af']);
    const t=random(hash(SEED_VERSION+':theme:'+family+':'+pseudo+':'+variation)),choose=a=>a[Math.floor(t()*a.length)],f=FAMILIES[family],theme=THEMES[family];
    const hue=choose(theme.hues)+Math.floor(t()*24)-12,world=choose(f.worlds);
    const palettePrimary=hsl(hue,88+Math.floor(t()*10),family==='horror'?51:53+Math.floor(t()*6));
    const colors={outfit:palettePrimary,lower:hsl(hue+choose([35,160,200]),84+Math.floor(t()*12),45+Math.floor(t()*8)),cape:hsl(hue+choose([30,165,200]),90,46+Math.floor(t()*8)),accent:hsl(hue+choose([35,155]),100,68),skin,light:species==='robot'?'#ddeaf0':tint(skin,1.32),dark:'#27174b',metal:world==='copper'?'#ffd356':'#9cbaff',glow:hsl(hue+150,100,70),white:'#fff3ff',hair,blush:'#ff5fae'};
    const genes={...identity,world,role:f.role,gear:choose(GEAR_POOLS[f.role]),hat:f.hat,cape:choose(theme.cape),offhand:'none',carryMode:armCount?'held':'worn',belt:choose(['buckle','pouches','sash']),trim:theme.trim};
    colors.magic=hsl(toHSL(colors.cape)[0]+170,100,65);
    const kit=LOADOUTS[family][(hash(SEED_VERSION+':loadout:'+family+':'+pseudo)[0]+variation)%LOADOUTS[family].length];
    Object.assign(genes,{loadoutName:kit.name,gear:kit.gear,hat:kit.hat,back:kit.back,costume:kit.costume,offhand:kit.offhand||'none',cape:kit.cape??genes.cape});
    const palette=[null,'#25123f'],materials={};
    for(const [name,color]of Object.entries(colors)){materials[name]=palette.length;palette.push(...colorRamp(color,name));}
    return {generator:VERSION,pseudo,family,variation,title:morph.name+' · '+f.title,identity,genes,colors,palette,materials,size:SIZE,pivot:{...PIVOT},directions:[...DIRECTIONS],walkFrames:4};
  }
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,s)=>a.map(v=>v*s);
  const longueurExacte=v=>Math.sqrt(v.reduce((t,x)=>t+x*x,0));
  const norm=a=>{const l=longueurExacte(a)||1;return mul(a,1/l);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const axes=[[1,0,0],[0,1,0],[0,0,1]];
  function model(avatar,frame=0){
    const g={...avatar.genes,bodyDepth:avatar.genes.bodyDepth*1.2,headDepth:avatar.genes.headDepth*1.25},parts=[],walking=frame>0,p=walking?frame-1:0;
    const stride=walking?[5,0,-5,0][p]:0,bob=walking&&(p===1||p===3)?(g.gait==='bounce'||g.gait==='spring'?2:1):0;
    const sway=walking?[1,0,-1,0][p]:0,z=v=>v+bob;
    const mapZ=v=>v<=18?v*g.legHeight/18:v<=34?g.legHeight+(v-18)*g.torsoHeight/16:g.legHeight+g.torsoHeight+(v-34)*g.headScale;
    const scaleZ=v=>v<=18?g.legHeight/18:v<=34?g.torsoHeight/16:g.headScale;
    const point=c=>[c[0],c[1],mapZ(c[2])];
    const rawPart=(c,r,mat,detail=false,axis=axes,type='ellipsoid')=>{const part={c,r,mat,axis,type,detail};parts.push(part);return part;};
    const ell=(c,r,mat,detail=false,axis=axes,type='ellipsoid')=>rawPart(point(c),[r[0],r[1],r[2]*scaleZ(c[2])],mat,detail,axis,type);
    const box=(c,r,mat,detail=false)=>ell(c,r,mat,detail,axes,detail?'box':'beveledbox');
    const worldBone=(a,b,r,mat,detail=false)=>{const ez=norm(sub(b,a));let ex=norm(cross([0,1,0],ez));if(Math.abs(dot(ez,[0,1,0]))>.98)ex=[1,0,0];const ey=norm(cross(ez,ex));return rawPart(mul(add(a,b),.5),[r,r,longueurExacte(sub(b,a))/2+r*.5],mat,detail,[ex,ey,ez]);};
    const bone=(a,b,r,mat,detail=false)=>worldBone(point(a),point(b),r,mat,detail);
    const spark=(c,mat='glow')=>{box(c,[.8,.5,.8],mat,true);box(add(c,[1.7,0,1.7]),[.45,.4,.45],mat,true);};

    // Chaque appendice appartient au même modèle : la caméra seule change de vue.
    if(g.cape!=='none'){
      const bottom=g.cape==='short'?19:10,shift=sway*1.3;
      for(let zz=bottom;zz<=33;zz+=2){
        const t=(33-zz)/(33-bottom),width=g.bodyWidth+t*(g.cape==='short'?1:3),yy=-g.bodyDepth-2-t*2;
        if(g.cape==='split'&&zz<20){for(const side of [-1,1])box([side*(width*.58)+shift*t,yy,z(zz)],[width*.34,1.1,1.1],'cape');}
        else if(g.cape==='ragged'&&zz<14){for(let i=-2;i<=2;i++)if(zz>=bottom+Math.abs(i%2)*2)box([i*width*.38+shift*t,yy,z(zz)],[width*.2,1.1,1.1],'cape');}
        else box([shift*t,yy,z(zz)],[width,1.1,1.1],'cape');
        if(zz>bottom+1)for(const side of [-1,1])box([side*(width-.8)+shift*t,yy-1.15,z(zz)],[.7,.35,1],'accent',true);
      }
      ell([0,0,z(34)],[g.bodyWidth,4,1.8],'cape');
      box([0,4,z(33.5)],[1.5,.8,1.5],'metal',true);
    }
    if(['fox','cat','dragon','imp'].includes(g.species)){
      const a=[0,-3,z(20)],b=[-2+sway,-7,z(12)],c=[3+sway,-g.tailLength,z(g.species==='cat'?22:15)];
      bone(a,b,g.species==='fox'?3:1.5,'skin');bone(b,c,g.species==='fox'?3:1.5,'skin');
      ell(c,[2,2,2.8],g.species==='dragon'?'accent':'light');
    }

    // Membres inférieurs : les pieds d'appui restent sur le même plan du sol.
    for(let i=0;i<g.legCount;i++){
      const n=g.legCount,xx=(i-(n-1)/2)*(n===2?10:n===4?6:4.5),side=i%2===0?-1:1;
      const phase=(p+(i>1?2:0))%4,step=walking?[4,0,-4,0][phase]*side:0;
      const lift=walking&&((side<0&&phase===3)||(side>0&&phase===1))?4:0;
      const fy=step+(i>1?-2:1),foot=[xx,fy,3+lift],hip=[xx*.4,i>1?-1:0,z(18)];
      const knee=[xx*.8,fy*.55+1,10+lift*.4];
      if(g.limbType==='tentacles'){
        bone(hip,[xx*.65,fy-2,z(10)],2.2,'lower');bone([xx*.65,fy-2,z(10)],foot,1.8,'skin');
        bone(foot,[xx+side*1.5,fy+2,3+lift],1.3,'skin');
        for(const h of [5,9])ell([xx*.85,fy+1,h+lift],[.7,.7,.8],'accent',true);
      }else if(g.limbType==='spring'){
        box(hip,[2.5,2.5,2.5],'lower');
        bone(add(foot,[0,0,2]),add(hip,[0,0,-1]),.85,'dark',true);
        for(let j=0;j<4;j++)ell([xx*.9,fy*.7,6+lift+j*(10-lift)/4],[2.7,2.6,.7],'metal');
        box(foot,[3,3,2],'accent');box(add(foot,[0,2.5,1]),[2,.6,.6],'light',true);
      }else{
        bone(hip,knee,2.4,'lower');bone(knee,add(foot,[0,-.6,1.6]),g.limbType==='talons'?1.5:2.2,['paws','claws','talons'].includes(g.limbType)?'skin':'lower');
        if(g.limbType==='hooves'){
          box(foot,[n>2?2.3:2.8,3,2],'dark');box(add(foot,[0,3,0]),[.5,.4,1.8],'metal',true);
        }else if(g.limbType==='boots'){
          const fw=Math.min(g.bootSize,n>2?2.4:3.5);
          box(foot,[fw,4,3],'dark');box(add(foot,[0,1.8,1.5]),[fw-.6,2,.8],'accent');
          box(add(foot,[0,-.5,3.8]),[2.5,2.1,1.4],'lower');
        }else{
          ell(foot,[n>2?2.3:g.limbType==='talons'?2.4:3.4,3,2],'skin');
          for(const toe of [-1,0,1])bone(add(foot,[toe*1.4,1.4,0]),add(foot,[toe*2,4,.1]),.65,g.limbType==='paws'?'light':'metal',true);
        }
      }
    }
    if(g.limbType==='hover'){
      ell([0,0,z(17)],[5,4,4],'lower');
      for(let i=0;i<3;i++)box([(i-1)*4+(walking?sway:0),1,4+(i*3+(walking?p*2:0))%9],[2.5-i*.5,1.6,1],'glow');
    }
    box([0,0,z(19)],[g.bodyWidth-.7,g.bodyDepth-.4,3],'lower');
    if(g.bodyShape==='square'){
      box([0,0,z(27)],[g.bodyWidth,g.bodyDepth,7],'outfit');
      box([0,-g.bodyDepth-.6,z(29)],[g.bodyWidth-2,1.2,3],'lower');
    }else if(g.bodyShape==='segment'){
      for(const zz of [23,27,31])ell([0,0,z(zz)],[g.bodyWidth,g.bodyDepth,2.5],'outfit');
    }else if(g.bodyShape==='pear'){
      ell([0,0,z(24)],[g.bodyWidth,g.bodyDepth+1,6],'outfit');
      ell([0,0,z(30)],[g.bodyWidth*.72,g.bodyDepth,4.5],'outfit');
    }else if(g.bodyShape==='shell'){
      ell([0,-1,z(27)],[g.bodyWidth,g.bodyDepth+1.5,8],'outfit');
      ell([0,-g.bodyDepth,z(27)],[g.bodyWidth+1,3,9],'skin');
      for(const xx of [-4,0,4])bone([xx,-g.bodyDepth-2,z(21)],[xx,-g.bodyDepth-3,z(32)],.7,'light',true);
    }else if(g.bodyShape==='taper'){
      ell([0,0,z(29)],[g.bodyWidth+1,g.bodyDepth,5.5],'outfit');
      ell([0,0,z(24)],[g.bodyWidth*.7,g.bodyDepth-.5,4.5],'outfit');
    }else{
      ell([0,0,z(27)],[g.bodyWidth,g.bodyDepth,g.bodyShape==='round'?9:8],'outfit');
    }
    box([0,0,z(21)],[g.bodyWidth,g.bodyDepth+.4,1.2],g.belt==='sash'?'accent':'dark');
    box([0,g.bodyDepth+1,z(21)],[1.6,.6,1.6],'metal',true);
    if(g.belt==='pouches')for(const side of [-1,1])box([side*5,g.bodyDepth,z(20)],[2.1,1.3,2.2],'accent');
    // Une couture et deux poches : aucun écusson, lettre ou pictogramme.
    for(const side of [-1,1])box([side*(g.bodyWidth*.53),g.bodyDepth,z(26)],[1.8,.45,1.5],'outfit',true);

    const hands=[];
    for(const side of [-1,1]){
      const begin=parts.length,spread=g.bodyWidth+g.armReach;
      const flap=walking?[2,-1,-2,1][p]*(g.appendageType==='wings'?1:side):0,swing=side*stride;
      if(g.appendageType==='arms'){
        const shoulder=[side*(g.bodyWidth-.5),1,z(31)],elbow=[side*(spread-1),2+swing*.4,z(27)];
        const h=[side*spread,2+swing,z(22)+flap];hands.push(h);
        bone(shoulder,elbow,3,'outfit');bone(elbow,h,2.4,g.handType==='mech'?'metal':'skin');
        ell(shoulder,[3.2,3.2,3],'outfit');
        if(g.handType==='mech')box(h,[3,2.8,3],'metal');
        else ell(h,[3,2.8,3],'skin');
        if(g.handType==='claws')for(const x of [-1,1])bone(add(h,[x*1.3,1,-1]),add(h,[x*1.5,2,-3]),.65,'light',true);
      }else if(g.appendageType==='wings'){
        const root=[side*(g.bodyWidth-1),0,z(31)],joint=[side*(g.bodyWidth+5),1,z(30+flap)];
        bone(root,joint,3,'skin');
        for(let k=0;k<4;k++){
          const start=add(joint,[-side*k*.8,-.3,-k*.9]);
          const tip=[side*(g.bodyWidth+10-k*1.4),1-k*1.8+Math.abs(flap)*.4,z(28-k*3+flap*1.8)];
          bone(start,tip,2.2, k===0?'skin':'light');
        }
        if(g.species!=='avian'){
          bone(joint,[side*(g.bodyWidth+9),1,z(22+flap)],2,'skin');
          bone(joint,[side*(g.bodyWidth+5),1,z(17+flap)],2.3,'skin');
        }
      }else if(g.appendageType==='fins'){
        const root=[side*(g.bodyWidth-1),1,z(29)];
        for(let k=0;k<4;k++){
          const tip=[side*(g.bodyWidth+9-k*1.2),1.5-k*1.2,z(29-k*3+flap)];
          bone(root,tip,2.2,k===0?'skin':'light');
        }
      }else{
        for(let row=0;row<2;row++){
          const root=[side*(g.bodyWidth-1),0,z(29-row*7)];
          const b=[side*(g.bodyWidth+5+row),2+swing*.25,z(30-row*10+flap)];
          const c=[side*(g.bodyWidth+10-row),2+swing*.4,z(25-row*11+flap)];
          const tip=[side*(g.bodyWidth+8-row),3+swing*.4,z(28-row*11+flap)];
          bone(root,b,2.5,'skin');bone(b,c,2,'skin');bone(c,tip,1.6,'light');
          ell(add(c,[0,1.7,1]),[.75,.6,.75],'light',true);
        }
      }
      for(let i=begin;i<parts.length;i++)parts[i].appendageSide=side;
    }
    const mainHand=hands[1],otherHand=hands[0];
    if(g.limbType==='fluke'){
      bone([0,0,z(18)],[sway*1.2,-1,7],3.2,'skin');
      for(const side of [-1,1])bone([sway*1.2,-1,7],[side*7+sway,-1,3+Math.abs(sway)],2.5,'light');
    }

    const hz=z(g.species==='mushroom'?40:41),hw=g.headWidth,hd=g.headDepth,hh=g.headHeight;
    ell([0,0,z(35)],[3,3,2.6],'skin');
    ell([0,0,hz],[hw,hd,hh],'skin');
    if(['robot','golem'].includes(g.species))box([0,0,hz],[hw-2,hd-1,hh-1],'skin');
    if(g.species==='human'){
      ell([0,-2,hz+4],[hw+.5,hd-1,4.8],'hair');
      for(let i=-1;i<=1;i++)box([i*4,hd*.4,hz+5],[2,2,2+Math.abs(i)],'hair');
    }
    if(g.species==='mushroom'){
      const lift=g.eyeCount>2?2:0;
      ell([0,-1,hz+6+lift],[hw+3,hd+2,4],'outfit');
      box([0,0,hz+4.6+lift],[hw+1,hd+1,1],'light');
      for(const [xx,yy]of [[-6,2],[4,4],[0,-4]])box([xx,yy,hz+8.5+lift-Math.abs(xx)*.12],[1.6,1.6,.6],'accent',true);
    }
    if(g.species==='robot'){
      box([0,hd-.3,hz],[hw-2,.6,4.5],'dark');
      box([0,-hd,hz],[4,1,4],'dark');box([0,-hd-1.2,hz],[2,.4,2],'glow',true);
      for(const s of [-1,1])box([s*hw,-1,hz],[1.5,2,3],'metal');
    }
    if(g.species==='golem')for(const s of [-1,1])box([s*(hw-1),-2,hz+2],[2,3,3],'skin');
    // Les oreilles et les cornes sont indépendantes de l'espèce et de la coiffe.
    for(let i=0;i<g.earCount;i++){
      const side=g.earCount===1?g.asymmetry:i%2===0?-1:1,row=Math.floor(i/2);
      const b=[side*(row?hw:hw-2),row?0:-1,hz+(g.species==='human'?-1:row?0:5)];
      if(g.earType==='round'){
        ell(add(b,[side*2,0,2]),[g.species==='human'?2:3,2.1,g.species==='human'?2.5:3.3],'skin');ell(add(b,[side*2,1.8,2]),[1,.8,1.3],'light',true);
      }else{
        const long=g.earType==='long'&&!row,tip=add(b,[side*(long?1:5),0,long?g.earLength+3:row?2:g.earLength-1]);
        bone(b,tip,long?1.8:2.2,'skin');bone(add(b,[0,1.8,1]),add(tip,[0,1.5,-1]),.8,'accent',true);
      }
    }
    for(let i=0;i<g.hornCount;i++){
      const xx=g.hornCount===1?0:(i-(g.hornCount-1)/2)*(g.hornCount===2?11:4.2),side=xx<0?-1:1;
      const b=[xx,-2,hz+hh-2],tip=[xx+side*(g.hornType==='curved'?3:1),-1,hz+13-Math.abs(xx)*.15];
      bone(b,[tip[0],-3,tip[2]-3],1.5,'metal');bone([tip[0],-3,tip[2]-3],tip,.95,'light',true);
      if(g.hornType==='antlers')bone(add(b,[0,0,2]),[xx+side*3,-2,hz+9],.85,'light',true);
    }

    // Yeux ovales laqués, regards plissés et joues rosées : visage façon émoticône.
    const eyeX=hw*.49,happy=g.eyeCount===2&&g.crest===1&&g.eyeStyle!=='serious';
    const positions=g.eyeCount===1?[[0,.3]]:g.eyeCount===2?[[-eyeX,.2],[eyeX,.2]]:
      g.eyeCount===3?[[0,3.4],[-eyeX,-2.5],[eyeX,-2.5]]:[[-eyeX,2.7],[eyeX,2.7],[-eyeX,-3.2],[eyeX,-3.2]];
    for(const [xx,zz]of positions){
      const eyeStart=parts.length;
      const yy=hd*Math.sqrt(Math.max(.3,1-(xx/hw)*(xx/hw)-(zz/hh)*(zz/hh)))+.75,large=g.eyeCount===1,multi=g.eyeCount>2;
      if(happy){
        bone([xx-2,yy,hz],[xx-.5,yy+.5,hz+1.5],.7,'dark',true);
        bone([xx-.5,yy+.5,hz+1.5],[xx+.7,yy+.5,hz+1.4],.7,'dark',true);
        bone([xx+.7,yy+.5,hz+1.4],[xx+2,yy,hz],.7,'dark',true);
      }else{
        const ex=large?4.2:multi?1.75:2.7,ey=large?4.1:multi?2:g.eyeStyle==='serious'?2.2:3.4;
        ell([xx,yy,hz+zz],[ex,.85,ey],'white',true);
        ell([xx+.3,yy+.8,hz+zz-.2],[ex*.77,.6,ey*.87],'dark',true);
        ell([xx+.4,yy+1.35,hz+zz-ey*.5],[ex*.48,.32,ey*.24],'glow',true);
        ell([xx-ex*.27,yy+1.55,hz+zz+ey*.36],[large?1.1:multi?.52:.8,.25,large?1.2:multi?.7:.95],'white',true);
        if(!multi)ell([xx+ex*.35,yy+1.55,hz+zz-ey*.4],[.4,.25,.45],'white',true);
        if(g.eyeStyle==='serious'&&!large)bone([xx-ex,yy+1,hz+zz+ey],[xx+ex,yy+1,hz+zz+ey-.9],.6,'dark',true);
      }
      const ay_=xx/(hw*hw),ax_=yy/(hd*hd),ar_=Math.sqrt(ax_*ax_+ay_*ay_),ca=ar_>0?ax_/ar_:1,sa=ar_>0?ay_/ar_:0,pivot=point([xx,yy,hz+zz]);
      const rotate=v=>[v[0]*ca+v[1]*sa,-v[0]*sa+v[1]*ca,v[2]];
      for(let i=eyeStart;i<parts.length;i++){const part=parts[i];part.c=add(pivot,rotate(sub(part.c,pivot)));part.axis=part.axis.map(rotate);}
    }
    const my=hd+.4;
    if(g.eyeCount<3&&g.species!=='robot')for(const side of [-1,1])ell([side*(eyeX+2),my-.7,hz-3.6],[2.1,.6,1.0],'blush',true);
    if(['fox','cat','dragon','rabbit'].includes(g.species)&&g.eyeCount<3){
      ell([0,my,hz-3.2],[3.3,1.5,1.7],'light',true);ell([0,my+1.5,hz-2.6],[1.0,.5,.7],'dark',true);
    }else if(g.species==='avian'){
      ell([0,my+.7,hz-3],[2.7,2.5,1.7],'hair');
    }else if(g.species==='cephalopod'){
      ell([0,my+.7,hz-3.5],[1.7,1.8,1.6],'light',true);
    }else if(g.species==='human'){
      ell([0,my+.3,hz-2.7],[1.5,1.2,1.0],'skin',true);
    }
    if(happy){
      ell([0,my+.6,hz-5],[2.5,.7,1.5],'dark',true);
      ell([0,my+1.35,hz-5.8],[1.4,.3,.6],'blush',true);
    }else if(g.species!=='avian'&&g.eyeCount<3){
      bone([-1.5,my+.6,hz-4.7],[0,my+.7,hz-5.3],.45,'dark',true);
      bone([0,my+.7,hz-5.3],[1.5,my+.6,hz-4.7],.45,'dark',true);
    }else if(g.eyeCount>2)ell([0,my,hz-6.3],[1.3,.5,.6],'dark',true);
    if(g.species==='aquatic')for(const side of [-1,1])for(let k=0;k<3;k++){
      bone([side*(hw-1),-1,hz-2+k*2],[side*(hw+3),-1,hz-4+k*3],1.1,'skin');
    }

    // Coiffes construites en volume : calotte, arrière, oreillettes, rebord et visière.
    const helmet=['combat','robot','space','aviator','moto','racer','sport','knight','miner','antenna'].includes(g.hat);
    const brow=g.eyeCount>2?7.3:6.4;
    if(helmet){
      const metal=['robot','knight','antenna'].includes(g.hat),mat=metal?'metal':'outfit';
      ell([0,-3,hz+1],[hw+1,hd-.6,hh+1.3],mat);
      if(g.hat==='robot'||g.hat==='knight')box([0,-2,hz+brow+1.6],[hw+1,hd,2.3],mat);
      else ell([0,-1,hz+brow+1.8],[hw+1.2,hd+1.2,3.0],mat);
      for(const side of [-1,1]){
        box([side*(hw-.4),-1,hz],[2.1,hd*.57,4.8],mat);
        if(g.hat!=='combat'&&g.hat!=='miner')ell([side*(hw+1.2),-1,hz+1],[1.3,3.1,3.2],'lower');
      }
      box([0,hd*.75,hz+brow-.4],[hw-.5,2.2,.8],'accent');
      if(['moto','racer','space','aviator','robot','sport'].includes(g.hat)){
        for(const side of [-1,1]){
          bone([side*(hw-1),hd*.65,hz+5.5],[side*(hw-1),hd*.8,hz-4],1.1,'dark');
          bone([side*(hw-1),hd*.8,hz-4],[side*5,hd+1,hz-7],1.7,mat);
        }
        box([0,hd+.8,hz-7],[5,1.5,1.25],mat);
        bone([-hw+2,hd*.8,hz+brow-.7],[0,hd+1.6,hz+brow-.1],.8,'glow',true);
        bone([0,hd+1.6,hz+brow-.1],[hw-2,hd*.8,hz+brow-.7],.8,'glow',true);
      }
      if(g.hat==='robot'){
        for(const side of [-1,1]){
          box([side*6,hd*.7,hz-6],[2.5,2,1.9],'metal');
          box([side*6,hd*.7+2,hz-6],[1.5,.3,.55],'glow',true);
          box([side*7,-hd-2,hz+1],[1.7,1,3],'glow');
        }
      }
      if(g.hat==='knight'){
        for(const side of [-1,1])box([side*(hw-.6),hd*.6,hz-4],[2,1.8,3.3],'metal');
        for(let k=0;k<4;k++)box([0,-5+k*2.3,hz+brow+4],[1.6,1.5,2],'cape');
      }
      if(g.hat==='miner'){
        ell([0,hd+1.5,hz+brow+1],[3,1.6,2.7],'metal');
        ell([0,hd+3,hz+brow+1],[2,1,1.8],'glow',true);
      }
      if(g.hat==='antenna'){
        bone([hw*.45,-2,hz+brow+2],[hw*.45,-2,hz+15],.8,'metal',true);
        ell([hw*.45,-2,hz+15],[2,2,1.8],'accent');
      }
    }else if(['wizard','witch','scholar'].includes(g.hat)){
      const base=hz+brow+1;
      box([0,0,base],[hw+2.5,hd+2.5,.9],'cape');
      if(g.hat==='scholar'){
        box([0,-1,base+3],[7,6,2.4],'cape');
        box([0,-1,base+5],[hw+1,hd+1,.6],'cape');
      }else{
        for(let k=0;k<6;k++)ell([k*.6,-1-k*.22,base+2+k*1.5],[6-k*.85,5.4-k*.7,1.4],'cape');
        box([0,hd*.5,base+2],[4.5,1,1],'accent');
      }
    }else if(g.hat==='cap'){
      ell([0,-1,hz+brow+1.3],[hw+.8,hd+1,3.1],'outfit');
      box([0,hd+2.6,hz+brow-.3],[hw-2,3.1,.8],'accent');
      box([0,-hd-1,hz+brow],[2.5,.7,.8],'accent',true);
    }else if(g.hat==='beret'||g.hat==='beanie'){
      ell([g.hat==='beret'?2:0,-1,hz+brow+1.7],[hw+1.3,hd+1,3],'cape');
      box([0,hd-.2,hz+brow-.7],[hw-1,1,.85],'accent');
      if(g.hat==='beanie')ell([0,-1,hz+brow+5],[2.3,2.3,2],'accent');
    }else if(g.hat==='tophat'){
      box([0,0,hz+brow+.3],[hw+2,hd+1.5,.8],'dark');
      box([0,-1,hz+brow+5],[7.5,6.4,4.5],'cape');
      box([0,5.6,hz+brow+2],[7.3,.6,1.3],'accent');
    }else if(g.hat==='straw'){
      ell([0,0,hz+brow+.7],[hw+3,hd+3,1.8],'metal');
      ell([0,-1,hz+brow+3.7],[7,6,3],'metal');
      box([0,hd*.6,hz+brow+1.5],[6,1,.8],'cape');
    }else if(g.hat==='hood'){
      ell([0,-3,hz+1],[hw+1.4,hd,hh+1.5],'cape');
      for(const side of [-1,1])bone([side*(hw-1),hd*.25,hz+6],[side*(hw-1),hd*.6,hz-6],1.5,'cape');
    }else if(g.hat==='bandana'){
      box([0,hd-.2,hz+brow],[hw-1,.8,1.15],'accent');
      box([0,-hd,hz+brow],[hw-1,1,1.15],'accent');
      for(const offset of [-1,1])bone([5,-hd,hz+brow],[8+offset+sway,-hd-5,hz+1+offset*2],1,'accent');
    }

    // Les objets gardent leurs proportions propres, indépendantes des petites jambes.
    function equip(type,h,side=1,scale=.9){
      const begin=parts.length,anchor=point(h),long=['staff','sword','scythe','skull','hammer','wrench','flag','bat','bo','torch','hook','key','racket'].includes(type);
      const to=d=>add(anchor,mul([d[0]+(long?side*Math.max(0,d[2])*.11:0),d[1],d[2]],scale));
      const E=(c,r,mat,detail=false)=>rawPart(to(c),mul(r,scale),mat,detail);
      const B=(c,r,mat,detail=false)=>rawPart(to(c),mul(r,scale),mat,detail,axes,detail?'box':'beveledbox');
      const L=(a,b,r,mat,detail=false)=>worldBone(to(a),to(b),r*scale,mat,detail||r<1.5);
      if(['staff','scythe','skull','hammer','wrench','flag','bat','bo','torch','hook'].includes(type)){
        const end=['staff','scythe','skull'].includes(type)?27:['flag','bo'].includes(type)?26:20;
        L([0,0,-6],[0,0,end],1.15,['staff','bo','bat','torch'].includes(type)?'hair':'metal');
        if(type==='staff'){
          E([0,0,29],[4.4,3.7,4.7],'magic');E([-.7,3.1,30.3],[1.3,.8,1.5],'white',true);
          B([0,0,24.9],[2.4,2.1,.9],'metal');
          for(const s of [-1,1])L([s*2.6,0,25],[s*4.1,0,29],.9,'metal');
        }
        if(type==='scythe'){
          L([0,0,27],[6,0,29],1.8,'metal');L([6,0,29],[10,0,23],1.6,'light');L([10,0,23],[9,0,20],.7,'light');
        }
        if(type==='skull'){
          E([0,0,27],[4.5,3.7,4.4],'white');
          for(const x of [-1.9,1.9])B([x,3.5,27],[1.1,.4,1.3],'dark',true);
          B([0,2.9,23.9],[2.4,.6,.8],'dark',true);
        }
        if(type==='hammer'){
          B([0,0,20],[5.2,3.5,3.7],'metal');B([0,3.6,20],[3,.4,2],'accent',true);
        }
        if(type==='wrench'){
          B([0,0,20],[3.3,1.7,2],'metal');for(const s of [-1,1])B([s*2.6,0,23],[1.1,1.7,3],'metal');
        }
        if(type==='flag'){
          B([4,0,21],[4,1.1,5.2],'accent');B([6,0,17],[2,1.1,1.8],'cape');
        }
        if(type==='bat')L([0,0,6],[0,0,22],2.4,'accent');
        if(type==='bo')for(const zz of [0,3,6])B([0,0,zz],[1.45,1.45,.45],'white',true);
        if(type==='torch'){
          B([0,0,18],[2.4,2.4,2.3],'metal');E([0,0,23],[3,2.5,4.3],'accent');E([0,1,24],[1.5,1.6,3],'glow');
        }
        if(type==='hook'){
          L([0,0,20],[4,0,24],1.3,'metal');L([4,0,24],[6,0,20],1.3,'metal');
        }
      }else if(type==='sword'){
        L([0,0,-4],[0,0,4],1.15,'hair');
        B([0,0,14],[2.1,1.5,10],'light');L([-1.6,0,23],[0,0,28],.9,'metal');L([1.6,0,23],[0,0,28],.9,'light');
        for(const s of [-1,1])L([0,0,4],[s*3,0,2.5],1.1,'accent');
        B([.9,1.55,14],[.5,.25,8],'glow',true);
      }else if(type==='shield'){
        const x=side*4,z=-4.5;
        E([x,-.4,z],[5.5,2.6,6.8],'metal');E([x,1.9,z],[4.5,.8,5.7],'cape');
        E([x,2.7,z+.5],[1.25,.5,1.4],'metal',true);
      }else if(type==='bow'){
        for(const a of [-1,1]){L([0,0,6],[3,0,6+a*8],1.25,'hair');L([3,0,6+a*8],[0,0,6+a*14],1,'accent');}
        L([0,0,-8],[0,0,20],.4,'light',true);L([0,0,6],[0,11,6],.6,'metal',true);
      }else if(['orb','crystal','chromeorb'].includes(type)){
        E([0,0,5],[4.6,4.3,4.8],type==='chromeorb'?'metal':'accent');
        E([-1.3,3.8,6.4],[1.2,.8,1.7],'glow',true);
      }else if(type==='book'){
        B([side*3,0,-2],[4.5,2.2,5],'cape');B([side*3,2.2,-2],[3.8,.6,4.2],'white');B([side*3,2.9,-2],[.45,.3,4.2],'metal',true);
      }else if(type==='lantern'){
        L([0,0,0],[0,0,-3],.7,'metal',true);
        B([0,0,-5],[3.1,2.7,3.8],'metal');B([0,2.7,-5],[2.2,.4,2.6],'glow');
        B([0,0,-1.6],[3.6,3,.8],'accent');B([0,0,-8.7],[3.6,3,.8],'accent');
      }else if(type==='key'){
        L([0,0,-3],[0,0,18],1.25,'metal');E([0,0,20],[4.5,1.8,4.5],'metal');E([0,1.8,20],[2.4,.5,2.4],'cape',true);
        for(const zz of [-1,3])B([-2.1,0,zz],[2,1.1,.8],'metal');
      }else if(type==='ball'){
        E([0,2,1],[4.8,4.8,4.8],'accent');for(const [x,y,z]of [[0,6.4,1],[3.5,4.5,2.5],[-3,4.5,-1]])B([x,y,z],[1.2,.7,1.2],'dark',true);
      }else if(type==='racket'){
        L([0,0,-3],[0,0,12],1.1,'accent');E([0,0,17],[4.3,1.4,6],'metal');E([0,1.5,17],[3.3,.3,4.8],'light',true);
        for(const zz of [14,16,18,20])B([0,1.9,zz],[2.9,.2,.25],'lower',true);
      }else if(type==='puzzlebox'){
        for(const [x,z,mat]of [[-2,0,'outfit'],[3,0,'accent'],[.5,5,'cape']])B([x,1,z],[2.4,3,2.4],mat);
      }else if(['blaster','rifle','cannon','bazooka'].includes(type)){
        const big=type==='cannon'||type==='bazooka',len=type==='blaster'?10:15,r=big?3.9:2.8;
        B([0,1,-1],[1.7,2,3.3],'dark');B([0,4,2],[r,4,r],'outfit');L([0,-1,2],[0,len,2],r*.8,'metal');
        B([0,len,2],[r,.8,r],'metal');B([0,len+.9,2],[r-1,.4,r-1],'dark',true);B([0,len+1.4,2],[1.2,.3,1.2],'magic',true);
        B([0,2,r+3],[1.25,3,1],'accent');B([r,3,2],[.4,2,1],'glow',true);
      }else if(type==='compass'){
        E([0,2,2],[4.5,2.8,4.5],'metal');E([0,4.8,2],[3.3,.5,3.3],'glow',true);E([-1,5.4,3],[.8,.3,1],'white',true);
      }
      for(let i=begin;i<parts.length;i++)parts[i].equipment=type;
    }

    function backGear(type){
      if(type==='none')return;
      const start=parts.length,center=point([0,-g.bodyDepth-4,z(27)]);
      const E=(d,r,mat)=>rawPart(add(center,d),r,mat);
      const B=(d,r,mat,detail=false)=>rawPart(add(center,d),r,mat,detail,axes,detail?'box':'beveledbox');
      const L=(a,b,r,mat,detail=false)=>worldBone(add(center,a),add(center,b),r,mat,detail);
      if(type==='jetpack'||type==='battery'||type==='springs'){
        B([0,0,0],[5.8,3.5,5.6],'lower');
        for(const side of [-1,1]){
          E([side*6.5,-.5,0],[2.5,3.5,7],'metal');B([side*6.5,-3.8,.5],[1.7,.5,4],'accent');
          if(type==='springs')for(let k=0;k<4;k++)B([side*6.5,-.5,-4+k*2.5],[3,3.9,.55],'metal');
          if(type==='jetpack')E([side*6.5,-.5,-7.5],[1.8,2.2,2.5+Math.abs(sway)],'glow');
        }
        if(type==='battery')B([0,-3.6,0],[3,.5,3.6],'glow');
      }else if(type==='quiver'){
        B([-3,-1,0],[3,3,7],'hair');
        for(let i=0;i<3;i++){L([-5+i*2,-1,-2],[-5+i*2,-1,16-i],.65,'metal',true);B([-5+i*2,-1,15-i],[1.3,.9,2],'accent');}
      }else{
        const offset=['satchel','toolbox','duffel'].includes(type)?3:0;
        B([offset,0,0],[type==='duffel'?7:5.8,3.7,type==='satchel'?4.8:6],'cape');
        B([offset,-3.7,2],[5.1,.6,2],'outfit');
        B([offset,-4,-2.5],[3.6,.8,2.3],'lower');
        for(const side of [-1,1])B([offset+side*3,-4.5,2],[.65,.5,1.5],'metal',true);
        if(type==='bedroll'){
          E([0,-.5,7],[7.2,3,2.3],'accent');for(const side of [-1,1])B([side*4,-.5,7],[.7,3.2,2.5],'lower');
        }
        if(type==='books')for(let k=0;k<3;k++)B([-3+k*3,-1,6+k*.7],[1.2,2.5,2.5],k%2?'accent':'light');
        if(type==='ammo')for(const side of [-1,1])for(let k=0;k<3;k++)B([side*6,-.5,-3+k*2.5],[1.1,2,.85],'metal');
        if(type==='toolbox'){L([-2,0,3],[-2,0,10],.75,'metal',true);B([-2,0,9],[1.7,1,1.6],'metal');}
      }
      for(const side of [-1,1])bone([side*4,g.bodyDepth+.4,z(30)],[side*4,g.bodyDepth+.6,z(22)],.8,'lower',true);
      for(let i=start;i<parts.length;i++)parts[i].equipment='back:'+type;
    }
    backGear(g.back);

    // La coupe des vêtements aide à lire le genre sans écrire sur les sprites.
    if(g.costume==='armor'){
      for(const side of [-1,1])ell([side*(g.bodyWidth-1),1,z(31)],[3.1,3.4,2.6],'metal');
      box([0,g.bodyDepth+.6,z(27)],[g.bodyWidth*.65,1,3.2],'outfit');
    }else if(g.costume==='overalls'){
      box([0,g.bodyDepth+.5,z(25)],[4.4,.8,3.7],'lower');
      for(const side of [-1,1])bone([side*3.5,g.bodyDepth+.5,z(31)],[side*3.5,g.bodyDepth+1,z(25)],.8,'lower',true);
    }else if(['racing','flight'].includes(g.costume)){
      for(const side of [-1,1])bone([side*(g.bodyWidth-1),g.bodyDepth*.65,z(31)],[side*(g.bodyWidth-1),g.bodyDepth*.65,z(23)],.8,'accent',true);
    }else if(g.costume==='gi'){
      bone([-4,g.bodyDepth+.6,z(33)],[3,g.bodyDepth+.6,z(23)],1.2,'light');
      box([0,g.bodyDepth+1,z(21)],[g.bodyWidth,.6,.7],'accent');
    }else if(g.costume==='jacket'){
      for(const side of [-1,1])box([side*(g.bodyWidth*.65),g.bodyDepth+.5,z(27)],[2,.65,3.6],'lower');
    }else if(g.costume==='sports'&&g.legCount===2){
      for(const side of [-1,1])box([side*5,2,z(11)],[2.4,2.8,2],'white');
    }
    if(g.gear==='scarf'||g.costume==='racing'){
      ell([0,0,z(34)],[g.bodyWidth*.8,g.bodyDepth+1.5,1.7],'accent');
      bone([2,-g.bodyDepth,z(34)],[7+sway,-g.bodyDepth-7,z(29)],1.9,'accent');
      bone([7+sway,-g.bodyDepth-7,z(29)],[3+sway,-g.bodyDepth-8,z(25)],1.5,'accent');
    }
    if(g.carryMode==='held'){
      if(['gloves','gauntlets','wraps','flippers'].includes(g.gear))for(const [i,h]of hands.entries()){
        const side=i===0?-1:1,begin=parts.length;
        if(g.gear==='flippers'){
          bone(h,add(h,[side*2,1,7]),3,'accent');box(add(h,[0,2.5,2]),[2,.6,3.5],'light',true);
        }else{
          const radius=g.gear==='wraps'?3.2:4.3;
          ell(h,[radius,3.4,3.8],g.gear==='wraps'?'white':'accent');
          box(add(h,[0,3.3,1]),[2,.6,1.8],g.gear==='gloves'?'outfit':'lower');
        }
        for(let k=begin;k<parts.length;k++)parts[k].appendageSide=side;
      }else if(g.gear!=='scarf')equip(g.gear,mainHand);
      if(g.offhand!=='none')equip(g.offhand,otherHand,-1,.83);
    }else{
      // Les appendices restent libres : l’objet est réellement fixé sur le harnais.
      if(['gloves','gauntlets','wraps'].includes(g.gear))for(const side of [-1,1]){
        ell([side*(g.bodyWidth+1),.5,z(28)],[2.8,3,3],g.gear==='wraps'?'white':'accent').appendageSide=side;
      }
      if(['blaster','rifle','cannon','bazooka'].includes(g.gear)){
        for(const side of [-1,1])equip(g.gear,[side*(g.bodyWidth*.65),-g.bodyDepth-2,z(33)],side,.56);
      }else if(!['scarf','gloves','gauntlets','wraps','flippers'].includes(g.gear)){
        const mounted=['sword','staff','scythe','skull','bo','bat','flag','key','racket','torch','hook','bow'].includes(g.gear);
        equip(g.gear,[mounted?g.bodyWidth+2:0,-g.bodyDepth-5,z(mounted?24:28)],1,.78);
      }
      if(g.offhand==='shield')equip('shield',[-g.bodyWidth-1,-g.bodyDepth-4,z(26)],-1,.7);
      if(g.gear==='flippers')for(const side of [-1,1])bone([side*5,-g.bodyDepth-2,z(25)],[side*11,-g.bodyDepth-2,z(31)],2.6,'accent');
    }

    return parts;
  }


  function renderFrame(avatar,direction='front',frame=0){
    if(!['front','back','right','left'].includes(direction))throw new RangeError('Direction inconnue.');
    if(!Number.isInteger(frame)||frame<0||frame>4)throw new RangeError('Image attendue : 0 (repos) à 4 (marche).');
    if(direction==='left'){
      const base=renderFrame(avatar,'right',frame),out=new Uint8Array(SIZE*SIZE);
      for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)out[y*SIZE+x]=base[y*SIZE+SIZE-1-x];return out;
    }
    const yaw=direction==='front'?0:direction==='back'?Math.PI:-Math.PI/2;
    const pitch=.20,co=direction==='front'?1:direction==='back'?-1:0,si=direction==='right'?-1:0,cp=0.9800665778412416,sp=0.19866933079506122;
    const R=[co,-si,0],U=[-si*sp,-co*sp,cp],D=[si*cp,co*cp,sp];
    const ray=mul(D,-1),light=norm(add(add(mul(R,-.5),mul(D,.65)),[0,0,.75]));
    const halfLight=norm(add(light,D));
    const pixels=new Uint8Array(SIZE*SIZE),depth=new Float64Array(SIZE*SIZE).fill(Infinity);
    const depthMaterial=new Uint8Array(SIZE*SIZE);
    const parts=model(avatar,frame);
    for(const part of parts){
      const rx=part.r.reduce((n,v,i)=>n+Math.abs(dot(part.axis[i],R))*v,0);
      const ry=part.r.reduce((n,v,i)=>n+Math.abs(dot(part.axis[i],U))*v,0);
      const cx=31.5+dot(part.c,R),cy=60-dot(part.c,U);
      // Amas de deux pixels pour les volumes, un pixel pour les yeux et les détails.
      const step=part.detail?1:2,offset=(step-1)/2;
      const xmin=Math.max(step,Math.floor((cx-rx-1)/step)*step),xmax=Math.min(63-step,Math.ceil(cx+rx+1));
      const ymin=Math.max(step,Math.floor((cy-ry-1)/step)*step),ymax=Math.min(63-step,Math.ceil(cy+ry+1));
      const ld=part.axis.map(a=>dot(ray,a));
      const inv=part.r.map(v=>1/(v*v));
      const aa=ld.reduce((n,v,i)=>n+v*v*inv[i],0);
      const bevelPlanes=[];
      if(part.type==='beveledbox'){
        const bevel=Math.min(1.4,...part.r.map(v=>v*.24));
        for(const [a,b]of [[0,1],[0,2],[1,2]])for(const sa of [-1,1])for(const sb of [-1,1]){
          const n=[0,0,0];n[a]=sa;n[b]=sb;bevelPlanes.push([n,part.r[a]+part.r[b]-bevel,dot(n,ld)]);
        }
        for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
          const n=[x,y,z];bevelPlanes.push([n,part.r[0]+part.r[1]+part.r[2]-bevel*1.5,dot(n,ld)]);
        }
      }
      for(let py=ymin;py<=ymax;py+=step)for(let px=xmin;px<=xmax;px+=step){
        const origin=add(add(mul(R,px+offset-31.5),mul(U,60-py-offset)),mul(D,100));
        const oc=sub(origin,part.c),lo=part.axis.map(a=>dot(oc,a));
        let t,normalLocal;
        if(part.type==='box'||part.type==='beveledbox'){
          let near=-Infinity,far=Infinity,normalAxis=0,normalSign=0,hit=true;
          for(let i=0;i<3;i++){
            if(Math.abs(ld[i])<1e-9){if(Math.abs(lo[i])>part.r[i]){hit=false;break;}continue;}
            let t1=(-part.r[i]-lo[i])/ld[i],t2=(part.r[i]-lo[i])/ld[i],sign=-1;
            if(t1>t2){[t1,t2]=[t2,t1];sign=1;}
            if(t1>near){near=t1;normalAxis=i;normalSign=sign;}far=Math.min(far,t2);
            if(near>far){hit=false;break;}
          }
          if(!hit)continue;
          normalLocal=[0,0,0];normalLocal[normalAxis]=normalSign;
          for(const [n,bound,denom]of bevelPlanes){
            const distance=bound-dot(n,lo);
            if(Math.abs(denom)<1e-9){if(distance<0){hit=false;break;}continue;}
            const at=distance/denom;
            if(denom<0){if(at>near){near=at;normalLocal=n;}}else far=Math.min(far,at);
            if(near>far){hit=false;break;}
          }
          if(!hit||near<0)continue;t=near;
        }else{
          const b=2*lo.reduce((n,v,i)=>n+v*ld[i]*inv[i],0),c=lo.reduce((n,v,i)=>n+v*v*inv[i],0)-1;
          const discriminant=b*b-4*aa*c;if(discriminant<0)continue;t=(-b-Math.sqrt(discriminant))/(2*aa);if(t<0)continue;
          normalLocal=lo.map((v,i)=>(v+ld[i]*t)*inv[i]);
        }
        const normal=norm(part.axis.reduce((n,a,i)=>add(n,mul(a,normalLocal[i])),[0,0,0]));
        const brightness=Math.max(0,dot(normal,light));
        // Ombres colorées et reflets serrés, comme de petites icônes vernies.
        let band=brightness<.18?0:brightness<.46?1:brightness<.76?2:3;
        if(part.detail)band=part.mat==='white'?5:part.mat==='light'?3:2;
        else if(part.mat!=='dark'){
          const shine=dot(normal,halfLight);
          if(shine>.989)band=5;else if(shine>.969)band=4;
        }
        if(part.mat==='glow')band=4;
        for(let oy=0;oy<step;oy++)for(let ox=0;ox<step;ox++){
          const at=(py+oy)*SIZE+px+ox;if(t>=depth[at])continue;
          pixels[at]=avatar.materials[part.mat]+band;depth[at]=t;depthMaterial[at]=avatar.materials[part.mat];
        }
      }
    }
    // Liseré extérieur d'un pixel, sans modifier l'ancrage ni recadrer une frame.
    const outlined=pixels.slice();
    for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){
      const at=y*SIZE+x;
      if(!pixels[at]&&[at-1,at+1,at-SIZE,at+SIZE].some(i=>pixels[i]))outlined[at]=1;
      else if(pixels[at]){
        const edge=[at-1,at+1,at-SIZE,at+SIZE].some(i=>pixels[i]&&depthMaterial[i]!==depthMaterial[at]&&depth[i]+3.5<depth[at]);
        if(edge)outlined[at]=depthMaterial[at];
      }
    }
    return outlined;
  }
  function buildFrames(avatar){return DIRECTIONS.flatMap(direction=>Array.from({length:5},(_,frame)=>({direction,frame,pixels:renderFrame(avatar,direction,frame)})));}
  function rgba(avatar,pixels){const out=new Uint8ClampedArray(SIZE*SIZE*4);const palette=avatar.palette.map(v=>v?rgb(v):[0,0,0]);pixels.forEach((n,i)=>{if(n){out.set(palette[n],i*4);out[i*4+3]=255;}});return out;}
  function paintCanvas(canvas,avatar,pixels){canvas.width=SIZE;canvas.height=SIZE;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.putImageData(new ImageData(rgba(avatar,pixels),SIZE,SIZE),0,0);}
  function rle(pixels){const out=[];for(let i=0;i<pixels.length;){const v=pixels[i];let end=i+1;while(end<pixels.length&&pixels[end]===v)end++;out.push(end-i,v);i=end;}return out;}
  function pack(avatar,frames=buildFrames(avatar)){
    const animations={};
    for(let row=0;row<DIRECTIONS.length;row++){
      const d=DIRECTIONS[row];animations[d+'_idle']={frames:[row*5],fps:1,loop:false};animations[d+'_walk']={frames:[row*5+1,row*5+2,row*5+3,row*5+4],fps:8,loop:true};
    }
    animations.left_idle={source:'right_idle',flipX:true};animations.left_walk={source:'right_walk',flipX:true};
    return {generator:VERSION,pseudo:avatar.pseudo,family:avatar.family,variation:avatar.variation,brand:{name:'NelfeStation'},identity:avatar.identity,source:SOURCE,traits:avatar.genes,colors:avatar.colors,rendering:{style:'vivid-pixel-art',bodyPixelStep:2,detailPixelStep:1,shadesPerMaterial:6,outline:'#25123f',lighting:'violet-shadows-pixel-highlights',depthScale:{head:1.25,body:1.2}},frameSize:{width:SIZE,height:SIZE},pivot:{...PIVOT},sheet:{width:320,height:192,columns:5,rows:3,rowOrder:DIRECTIONS,columnOrder:['idle','walk_0','walk_1','walk_2','walk_3'],transparentIndex:0},palette:avatar.palette,encoding:'rle-count-index-row-major',animations,frames:frames.map((f,i)=>({id:i,direction:f.direction,state:f.frame===0?'idle':'walk',frame:f.frame===0?0:f.frame-1,rect:{x:f.frame*SIZE,y:Math.floor(i/5)*SIZE,width:SIZE,height:SIZE},pixelsRLE:rle(f.pixels)}))};
  }
  function resolveGenres(game){
    if(!game||typeof game!=='object')return [];
    if(typeof game.genreSlug==='string'&&Object.hasOwn(FAMILIES,game.genreSlug))return[game.genreSlug];
    const raw=game.genres??game.Genres??'',ids=new Set((Array.isArray(raw)?raw.join(','):String(raw)).split(',').map(x=>x.trim()));
    const clean=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'");
    const label=clean(game.genre??game.Genre??'');return GENRE_MAP.filter(g=>g.ids.some(id=>ids.has(id))||g.labels.some(s=>label.includes(clean(s)))||label===g.slug).map(g=>g.slug);
  }
  function fromGames(pseudo,games){
    if(!Array.isArray(games))throw new TypeError('Une liste de jeux est attendue.');
    const seconds=Object.fromEntries(Object.keys(FAMILIES).map(k=>[k,0])),plays={...seconds};let ignored=0;
    for(const game of games){if(!game||typeof game!=='object')throw new TypeError('Jeu invalide.');const s=Number(game.seconds??0),p=Number(game.plays??0);if(!Number.isFinite(s)||!Number.isFinite(p)||s<0||p<0)throw new RangeError('Les durées et les parties doivent être positives ou nulles.');const f=resolveGenres(game)[0];if(!f){ignored++;continue;}seconds[f]+=s;plays[f]+=p;}
    const weights=Object.values(seconds).some(v=>v>0)?seconds:plays;let top=0,family=null;
    for(const[f,n]of Object.entries(weights)){if(!Number.isFinite(n))throw new RangeError('Profil trop grand.');if(n>top){top=n;family=f;}}
    if(!family)throw new RangeError('Aucun genre reconnu avec du temps joué ou des parties.');
    return {avatar:generate(pseudo,{family}),metric:weights===seconds?'seconds':'plays',ignored};
  }
  return Object.freeze({generate,renderFrame,buildFrames,rgba,paintCanvas,pack,resolveGenres,fromGames,normalizePseudo,families:FAMILIES,species:SPECIES,worlds:WORLDS,gear:GEAR,limbs:LIMBS,appendages:APPENDAGES,capes:CAPES,hats:HATS,backs:BACKS,loadouts:LOADOUTS,morphs:MORPHS,source:SOURCE,SIZE,colorRamp,hsl,toHSL});
})();
if(typeof module!=='undefined'&&module.exports){module.exports=Avatar64;}else{(typeof self!=='undefined'?self:globalThis).Avatar64=Avatar64;}
