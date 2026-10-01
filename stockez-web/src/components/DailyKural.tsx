import React, { useEffect, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { isAdmin } from '../utils/permissions';

type KuralEntry = {
  type: 'kural';
  number: number;
  chapter: string;
  tamil: string;
  tamilMeaning: string;
  meaning: string;
};

type QuoteEntry = {
  type: 'quote';
  text: string;
  author: string;
  role: string;
};

type Entry = KuralEntry | QuoteEntry;

const ENTRIES: Entry[] = [
  // ── Thirukkural ──────────────────────────────────────────────────────────
  // Verified against the authoritative 1330-verse text (Number, couplet, and
  // meaning all cross-checked) so nothing shown here misattributes a verse.
  {
    type: 'kural', number: 400, chapter: 'The Value of Education',
    tamil: 'கேடில் விழுச்செல்வம் கல்வி யொருவற்கு\nமாடல்ல மற்றை யவை',
    tamilMeaning: 'ஒருவனுக்கு அழிவு இல்லாத சிறந்த செல்வம் கல்வியே; கல்வியைத் தவிர மற்றப் பொருள்கள் அத்தகைய சிறப்புடைய செல்வம் அல்ல.',
    meaning: 'Learning is the one wealth that never perishes — every other kind of riches can be lost.',
  },
  {
    type: 'kural', number: 621, chapter: 'Fortitude in Adversity',
    tamil: 'இடுக்கண் வருங்கால் நகுக அதனை\nஅடுத்தூர்வது அஃதொப்ப தில்',
    tamilMeaning: 'துன்பம் வரும்போது அதற்காக கலங்காமல் நகுதல் வேண்டும்; அத் துன்பத்தை எதிர்த்து வெல்லவல்லது அதைப் போன்றது வேறு இல்லை.',
    meaning: 'When trouble comes, meet it with a smile — nothing else defeats sorrow as well as that.',
  },
  {
    type: 'kural', number: 591, chapter: 'Perseverance',
    tamil: 'உடையர் எனப்படுவது ஊக்கம் அஃதில்லார்\nஉடையது உடையரோ மற்று',
    tamilMeaning: 'ஒருவர் பெற்றிருக்கின்றார் என்று சொல்லத்தக்க சிறப்புடையது ஊக்கமாகும்; ஊக்கம் இல்லாதவர் வேறு எதைப் பெற்றிருந்தாலும் அதை உடையவர் ஆவரோ.',
    meaning: 'Drive and energy are true possessions — without them, even what a person holds can hardly be called their own.',
  },
  {
    type: 'kural', number: 1031, chapter: 'The Glory of Hard Work',
    tamil: 'சுழன்றும்ஏர்ப் பின்னது உலகம் அதனால்\nஉழந்தும் உழவே தலை',
    tamilMeaning: 'உலகம் பல தொழில் செய்து சுழன்றாலும் ஏர்த் தொழிலின் பின் நிற்கின்றது; அதனால் எவ்வளவு துன்புற்றாலும் உழவுத் தொழிலே சிறந்தது.',
    meaning: 'However the world turns and toils at many trades, it comes back to the plough in the end — honest labour remains supreme.',
  },
  {
    type: 'kural', number: 200, chapter: 'Purposeful Speech',
    tamil: 'சொல்லுக சொல்லிற் பயனுடைய சொல்லற்க\nசொல்லிற் பயனிலாச் சொல்',
    tamilMeaning: 'சொற்களில் பயன் உடைய சொற்களை மட்டுமே சொல்ல வேண்டும்; பயன் இல்லாதவைகளாகிய சொற்களை சொல்லவே கூடாது.',
    meaning: 'Speak only words that serve a purpose; never waste breath on words that serve none.',
  },
  {
    type: 'kural', number: 398, chapter: 'The Power of Knowledge',
    tamil: 'ஒருமைக்கண் தான்கற்ற கல்வி ஒருவற்கு\nஎழுமையும் ஏமாப் புடைத்து',
    tamilMeaning: 'ஒரு பிறப்பில் தான் கற்றக் கல்வியானது அப்பிறப்பிற்கு மட்டும் அல்லாமல் அவனுக்கு ஏழுபிறவியிலும் உதவும் தன்மை உடையது.',
    meaning: 'Knowledge gained in one lifetime becomes a strength that carries a person through every lifetime after.',
  },
  {
    type: 'kural', number: 472, chapter: 'Know Your Strength',
    tamil: 'ஒல்வ தறிவது அறிந்ததன் கண்தங்கிச்\nசெல்வார்க்குச் செல்லாதது இல்',
    tamilMeaning: 'தனக்குப் பொருந்தும் செயலையும் அதற்காக அறிய வேண்டியதையும் அறிந்து அதனிடம் நிலைத்து முயல்கின்றவர்க்கு முடியாதது ஒன்றும் இல்லை.',
    meaning: 'Nothing is beyond reach for those who first understand their own strength, and then act steadily within it.',
  },
  {
    type: 'kural', number: 414, chapter: 'The Value of Listening',
    tamil: 'கற்றில னாயினுங் கேட்க அஃதொருவற்கு\nஒற்கத்தின் ஊற்றாந் துணை',
    tamilMeaning: 'நூல்களைக் கற்றவில்லையாயினும், கற்றறிந்தவர்களிடம் கேட்டறிய வேண்டும்; அது ஒருவனுக்கு வாழ்க்கையில் தளர்ச்சி வந்த போது ஊன்றுகோல் போல் துணையாகும்.',
    meaning: 'Even without formal learning, listen to the wise — that listening becomes a staff to lean on when life falters.',
  },
  {
    type: 'kural', number: 100, chapter: 'The Utterance of Pleasant Words',
    tamil: 'இனிய உளவாக இன்னாத கூறல்\nகனிஇருப்பக் காய்கவர்ந் தற்று',
    tamilMeaning: 'இனிய சொற்கள் இருக்கும்போது அவற்றை விட்டுக் கடுமையான சொற்களைக் கூறுதல், கனிகள் இருக்கும்போது அவற்றை விட்டுக் காய்களைப் பறித்துத் தின்பதைப் போன்றது.',
    meaning: 'To speak harshly when kind words are just as available is like eating a raw fruit while a ripe one hangs beside it.',
  },
  {
    type: 'kural', number: 104, chapter: 'Gratitude',
    tamil: 'தினைத்துணை நன்றி செயினும் பனைத்துணையாக்\nகொள்வர் பயன்தெரி வார்',
    tamilMeaning: 'ஒருவன் தினையளவாகிய உதவியைச் செய்த போதிலும், அதன் பயனை ஆராய்கின்றவர் அதனையே பனையளவாகக் கொண்டு போற்றுவர்.',
    meaning: 'Even a favour as small as a millet seed is remembered, by those who understand its worth, as large as a palmyra fruit.',
  },
  {
    type: 'kural', number: 120, chapter: 'The Ethics of Trade',
    tamil: 'வாணிகம் செய்வார்க்கு வாணிகம் பேணிப்\nபிறவும் தமபோல் செயின்',
    tamilMeaning: 'பிறர் பொருளையும் தம் பொருள் போல் போற்றிச் செய்தால், அதுவே வாணிகம் செய்வோர்க்கு உரிய நல்ல வாணிக முறையாகும்.',
    meaning: 'True business is guarding what belongs to others as carefully as one guards one\'s own.',
  },
  {
    type: 'kural', number: 121, chapter: 'The Possession of Self-Restraint',
    tamil: 'அடக்கம் அமரருள் உய்க்கும் அடங்காமை\nஆரிருள் உய்த்து விடும்',
    tamilMeaning: 'அடக்கம் ஒருவனை உயர்த்தித் தேவருள் சேர்க்கும்; அடக்கம் இல்லாதிருத்தல் பொல்லாத இருள் போன்ற தீய வாழ்க்கையில் செலுத்தி விடும்.',
    meaning: 'Self-control raises a person to greatness; the lack of it drags them into the deepest darkness.',
  },
  {
    type: 'kural', number: 127, chapter: 'Guarding the Tongue',
    tamil: 'யாகாவா ராயினும் நாகாக்க காவாக்கால்\nசோகாப்பர் சொல்லிழுக்குப் பட்டு',
    tamilMeaning: 'காக்க வேண்டியவற்றுள் எவற்றைக் காக்காவிட்டாலும் நாவையாவது காக்க வேண்டும்; காக்கத் தவறினால் சொற்குற்றத்தில் அகப்பட்டுத் துன்புறுவர்.',
    meaning: 'Whatever else you leave unguarded, guard your tongue — a slip of speech brings a sorrow that lingers longest.',
  },
  {
    type: 'kural', number: 131, chapter: 'Good Conduct',
    tamil: 'ஒழுக்கம் விழுப்பந் தரலான் ஒழுக்கம்\nஉயிரினும் ஓம்பப் படும்',
    tamilMeaning: 'ஒழுக்கமே எல்லார்க்கும் மேன்மையைத் தருவதாக இருப்பதால், அந்த ஒழுக்கமே உயிரை விடச் சிறந்ததாகப் போற்றப்படும்.',
    meaning: 'Good conduct confers greatness on a person — it deserves to be guarded even more carefully than life itself.',
  },
  {
    type: 'kural', number: 151, chapter: 'Patience',
    tamil: 'அகழ்வாரைத் தாங்கும் நிலம்போலத் தம்மை\nஇகழ்வார்ப் பொறுத்தல் தலை',
    tamilMeaning: 'தன்னை வெட்டுவோரையும் விழாமல் தாங்குகின்ற நிலம் போல், தம்மை இகழ்வாரையும் பொறுப்பதே தலையான பண்பாகும்.',
    meaning: 'To bear with those who insult us, as the earth bears those who dig into it, is the first of all virtues.',
  },
  {
    type: 'kural', number: 170, chapter: 'Not Envying',
    tamil: 'அழுக்கற்று அகன்றாரும் இல்லை அஃதுஇல்லார்\nபெருக்கத்தில் தீர்ந்தாரும் இல்',
    tamilMeaning: 'பொறாமைப்பட்டுப் பெருமையுற்றவரும் உலகத்தில் இல்லை; பொறாமை இல்லாதவராய் மேம்பாட்டிலிருந்து நீங்கியவரும் இல்லை.',
    meaning: 'No envious person has ever become great, and no person free of envy has ever remained without greatness.',
  },
  {
    type: 'kural', number: 181, chapter: 'Not Backbiting',
    tamil: 'அறங்கூறான் அல்ல செயினும் ஒருவன்\nபுறங்கூறான் என்றல் இனிது',
    tamilMeaning: 'ஒருவன் அறத்தைப் போற்றிக் கூறாதவனாய் அறமல்லாதவற்றைச் செய்தாலும், மற்றவனைப் பற்றிப் புறங்கூறாமல் இருக்கிறான் என்று சொல்லப்படுதல் நல்லது.',
    meaning: 'Even one who cannot claim to live virtuously earns respect if it can be said of them: they never spoke ill of another behind their back.',
  },
  {
    type: 'kural', number: 221, chapter: 'Giving',
    tamil: 'வறியார்க்கொன்று ஈவதே ஈகைமற் றெல்லாம்\nகுறியெதிர்ப்பை நீர துடைத்து',
    tamilMeaning: 'வறியவர்க்கு ஒரு பொருளைக் கொடுப்பதே ஈகை எனப்படுவது; மற்றவர்க்குக் கொடுப்பதெல்லாம் பயன் எதிர்பார்த்துக் கொடுக்கும் தன்மை உடையது.',
    meaning: 'To give to those in genuine need is true charity — every other gift quietly expects something in return.',
  },
  {
    type: 'kural', number: 231, chapter: 'Renown',
    tamil: 'ஈதல் இசைபட வாழ்தல் அதுவல்லது\nஊதியம் இல்லை உயிர்க்கு',
    tamilMeaning: 'வறியவர்க்கு ஈதல் வேண்டும், அதனால் புகழ் உண்டாக வாழ வேண்டும்; அப் புகழ் அல்லாமல் உயிர்க்கு ஊதியமானது வேறொன்றும் இல்லை.',
    meaning: 'To give and live with a good name is the only true profit a person gains in this life.',
  },
  {
    type: 'kural', number: 241, chapter: 'Compassion',
    tamil: 'அருட்செல்வம் செல்வத்துள் செல்வம் பொருட்செல்வம்\nபூரியார் கண்ணும் உள',
    tamilMeaning: 'பொருள்களாகிய செல்வங்கள் இழிந்தவரிடத்திலும் உள்ளன; உயர்ந்தவரிடத்தில் மட்டுமே உள்ள அருளாகிய செல்வமே செல்வங்களில் சிறந்த செல்வமாகும்.',
    meaning: 'Kindness is the wealth of wealth — mere riches can be found even among the meanest of men.',
  },
  {
    type: 'kural', number: 291, chapter: 'Truthfulness',
    tamil: 'வாய்மை எனப்படுவது யாதெனின் யாதொன்றும்\nதீமை இலாத சொலல்',
    tamilMeaning: 'வாய்மை என்று கூறப்படுவது எது என்றால், அது மற்றவர்க்கு ஒரு சிறிதும் தீங்கு இல்லாத சொற்களைச் சொல்லுதல் ஆகும்.',
    meaning: 'Truth is nothing more, and nothing less, than speaking words that cause no harm to anyone.',
  },
  {
    type: 'kural', number: 305, chapter: 'Restraining Anger',
    tamil: 'தன்னைத்தான் காக்கின் சினங்காக்க காவாக்கால்\nதன்னையே கொல்லுஞ் சினம்',
    tamilMeaning: 'ஒருவன் தன்னைத்தான் காத்துக் கொள்வதானால் சினம் வராமல் காத்துக் கொள்ள வேண்டும்; காக்காவிட்டால் சினம் தன்னையே அழித்து விடும்.',
    meaning: 'If a person wishes to protect themselves, let them guard against anger — left unguarded, anger destroys the one who feels it.',
  },
  {
    type: 'kural', number: 318, chapter: 'The Golden Rule',
    tamil: 'தன்னுயிர்க்கு இன்னாமை தானறிவான் என்கொலோ\nமன்னுயிர்க்கு இன்னா செயல்',
    tamilMeaning: 'தன் உயிருக்குத் துன்பமானவை இவை என்று உணர்ந்தவன், அத் துன்பத்தை மற்ற உயிருக்குச் செய்தல் என்ன காரணத்தாலோ.',
    meaning: 'Why would anyone inflict on another the very pain they know, from their own experience, to be unbearable?',
  },
  {
    type: 'kural', number: 391, chapter: 'Learning',
    tamil: 'கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தக',
    tamilMeaning: 'கல்வி கற்க நல்ல நூல்களைக் குற்றமறக் கற்க வேண்டும்; அவ்வாறு கற்ற பிறகு, கற்ற கல்விக்குத் தக்கவாறு நெறியில் நிற்க வேண்டும்.',
    meaning: 'Learn thoroughly whatever you set out to learn — and then live in a manner worthy of that learning.',
  },
  {
    type: 'kural', number: 411, chapter: 'The Wealth of Listening',
    tamil: 'செல்வத்துட் செல்வஞ் செவிச்செல்வம் அச்செல்வம்\nசெல்வத்து ளெல்லாந் தலை',
    tamilMeaning: 'செவியால் கேட்டறியும் செல்வம் செல்வங்களுள் ஒன்றாகப் போற்றப்படும் செல்வமாகும்; அச் செல்வம் செல்வங்கள் எல்லாவற்றிலும் தலையானதாகும்.',
    meaning: 'Among all forms of wealth, the wealth gained through listening and learning stands first.',
  },
  {
    type: 'kural', number: 421, chapter: 'Wisdom as a Fortress',
    tamil: 'அறிவற்றங் காக்குங் கருவி செறுவார்க்கும்\nஉள்ளழிக்க லாகா அரண்',
    tamilMeaning: 'அறிவு அழிவு வராமல் காக்கும் கருவியாகும்; அன்றியும் பகைகொண்டு எதிர்ப்பவர்க்கும் அழிக்க முடியாத உள்ளரணும் ஆகும்.',
    meaning: 'Wisdom is a weapon against ruin — an inner fortress that even enemies cannot breach.',
  },
  {
    type: 'kural', number: 430, chapter: 'Wisdom is Everything',
    tamil: 'அறிவுடையார் எல்லா முடையார் அறிவிலார்\nஎன்னுடைய ரேனும் இலர்',
    tamilMeaning: 'அறிவுடையவர் வேறொன்றும் இல்லாதிருப்பினும் எல்லாம் உடையவரே ஆவர்; அறிவில்லாதவர் வேறு என்ன உடையவராக இருப்பினும் ஒன்றும் இல்லாதவரே ஆவர்.',
    meaning: 'Those who possess wisdom possess everything; those without it possess nothing, whatever else they hold.',
  },
  {
    type: 'kural', number: 462, chapter: 'Think Before You Act',
    tamil: 'தெரிந்த இனத்தொடு தேர்ந்தெண்ணிச் செய்வார்க்கு\nஅரும்பொருள் யாதொன்றும் இல்',
    tamilMeaning: 'ஆராய்ந்து சேர்ந்த இனத்துடன் செயலைப்பற்றி நன்றாகத் தேர்ந்து, தாமும் எண்ணிப்பார்த்துச் செய்கின்றவர்க்கு அரிய பொருள் ஒன்றும் இல்லை.',
    meaning: 'Nothing is too difficult for those who reflect carefully and consult trusted people before they act.',
  },
  {
    type: 'kural', number: 467, chapter: 'Decide, Then Commit',
    tamil: 'எண்ணித் துணிக கருமம் துணிந்தபின்\nஎண்ணுவம் என்பது இழுக்கு',
    tamilMeaning: 'செய்யத் தகுந்த செயலையும் வழிகளையும் எண்ணிய பிறகே துணிந்து தொடங்க வேண்டும்; துணிந்த பின் எண்ணிப் பார்க்கலாம் என்பது குற்றமாகும்.',
    meaning: 'Think it through, then commit — to keep saying "let me think about it" after you\'ve already started is simply a failure of resolve.',
  },
  {
    type: 'kural', number: 513, chapter: 'Choosing the Right People',
    tamil: 'அன்பறிவு தேற்றம் அவாவின்மை இந்நான்கும்\nநன்குடையான் கட்டே தெளிவு',
    tamilMeaning: 'அன்பு, அறிவு, ஐயமில்லாமல் தெளியும் ஆற்றல், அவா இல்லாமை ஆகிய இந் நான்கு பண்புகளையும் நிலையாக உடையவனைத் தெளியலாம்.',
    meaning: 'Place your trust in those who combine four qualities: affection, knowledge, a clear mind, and freedom from greed.',
  },
  {
    type: 'kural', number: 537, chapter: 'Careful, Unfailing Effort',
    tamil: 'அரியஎன்று ஆகாத இல்லைபொச் சாவாக்\nகருவியால் போற்றிச் செயின்',
    tamilMeaning: 'மறவாமை என்னும் கருவிகொண்டு கடமைகளைப் போற்றிச் செய்தால், செய்வதற்கு அரியவை என்று ஒருவனால் முடியாத செயல்கள் இல்லை.',
    meaning: 'Nothing is too difficult to achieve for one who pursues it carefully, without ever letting it slip from mind.',
  },
  {
    type: 'kural', number: 578, chapter: 'Kindness Without Compromise',
    tamil: 'கருமம் சிதையாமல் கண்ணோட வல்லார்க்கு\nஉரிமை உடைத்திவ் வுலகு',
    tamilMeaning: 'தம் தம் கடமையாகிய தொழில் கெடாமல் கண்ணோட்டம் உடையவராக இருக்க வல்லவர்க்கு இவ்வுலகம் உரிமை உடையது.',
    meaning: 'The world belongs to those who can be kind without ever neglecting their duty.',
  },
  {
    type: 'kural', number: 594, chapter: 'Energy Attracts Wealth',
    tamil: 'ஆக்கம் அதர்வினாய்ச் செல்லும் அசைவிலா\nஊக்க முடையா னுழை',
    tamilMeaning: 'சோர்வு இல்லாத ஊக்கம் உடையவனிடத்தில் ஆக்கமானது தானே அவன் உள்ள இடத்திற்கு வழி கேட்டுக்கொண்டு போய்ச் சேரும்.',
    meaning: 'Wealth finds its own way to the person of tireless energy, wherever they may be.',
  },
  {
    type: 'kural', number: 601, chapter: 'The Cost of Idleness',
    tamil: 'குடியென்னும் குன்றா விளக்கம் மடியென்னும்\nமாசூர மாய்ந்து கெடும்',
    tamilMeaning: 'ஒருவனுக்குத் தன் குடியாகிய மங்காத விளக்கு, அவனுடைய சோம்பலாகிய மாசு படிய படிய ஒளி மங்கிக் கெட்டுவிடும்.',
    meaning: 'Idleness extinguishes even a lamp that would otherwise never go out — the good name of a family or a business.',
  },
  {
    type: 'kural', number: 644, chapter: 'Know Your Audience',
    tamil: 'திறனறிந்து சொல்லுக சொல்லை அறனும்\nபொருளும் அதனினூஉங்கு இல்',
    tamilMeaning: 'சொல்லின் திறத்தை அறிந்து சொல்லை வழங்க வேண்டும்; அத்தகைய சொல்வன்மையை விடச் சிறந்த அறமும் பொருளும் இல்லை.',
    meaning: 'Understand who you are speaking to before you speak — no virtue or wealth outweighs the value of well-placed words.',
  },
  {
    type: 'kural', number: 647, chapter: 'The Unshakeable Speaker',
    tamil: 'சொலல்வல்லன் சோர்விலன் அஞ்சான் அவனை\nஇகல்வெல்லல் யார்க்கும் அரிது',
    tamilMeaning: 'தான் கருதியவற்றை நன்கு சொல்ல வல்லவனாய், சொல்லும்போது சோர்வு இல்லாதவனாய், அஞ்சாதவனாய் உள்ளவனை மாறுபாட்டால் வெல்வது யார்க்கும் முடியாது.',
    meaning: 'No one can defeat, in any argument, a speaker who is skilled, unwavering, and unafraid.',
  },
  {
    type: 'kural', number: 666, chapter: 'Firmness of Purpose',
    tamil: 'எண்ணிய எண்ணியாங்கு எய்துவர் எண்ணியார்\nதிண்ணியர் ஆகப் பெறின்',
    tamilMeaning: 'எண்ணியவர் எண்ணியபடியே செயல் ஆற்றுவதில் உறுதியுடையவராக இருக்கப்பெற்றால், அவர் எண்ணியவற்றை எண்ணியவாறே அடைவர்.',
    meaning: 'Those who plan with firm resolve achieve exactly what they set out to achieve.',
  },
  {
    type: 'kural', number: 754, chapter: 'Wealth, Earned Honestly',
    tamil: 'அறன்ஈனும் இன்பமும் ஈனும் திறனறிந்து\nதீதின்றி வந்த பொருள்',
    tamilMeaning: 'சேர்க்கும் திறம் அறிந்து தீமை ஒன்றும் இல்லாமல் சேர்க்கப்பட்டு வந்த பொருள், ஒருவனுக்கு அறத்தையும் இன்பத்தையும் கொடுக்கும்.',
    meaning: 'Wealth gathered by fair means, with a clear conscience, brings both virtue and true happiness.',
  },
  {
    type: 'kural', number: 786, chapter: 'True Friendship',
    tamil: 'முகநக நட்பது நட்பன்று நெஞ்சத்து\nஅகநக நட்பது நட்பு',
    tamilMeaning: 'முகம் மட்டும் மலரும்படியாக நட்பு செய்வது நட்பு அன்று; நெஞ்சமும் மலரும்படியாக உள்ளன்பு கொண்டு நட்பு செய்வதே நட்பு ஆகும்.',
    meaning: 'Friendship that lives only in a smiling face is no friendship at all; true friendship lives in a heart that smiles.',
  },
  {
    type: 'kural', number: 793, chapter: 'Choose Your Partners Wisely',
    tamil: 'குணமும் குடிமையும் குற்றமும் குன்றா\nஇனனும் அறிந்தியாக்க நட்பு',
    tamilMeaning: 'ஒருவனுடைய குணத்தையும், குடிப்பிறப்பையும், குற்றத்தையும், அவனுடன் தொடர்புடையோரின் இயல்பையும் அறிந்தே அவனோடு நட்புக் கொள்ள வேண்டும்.',
    meaning: 'Form a friendship — or a partnership — only after learning someone\'s character, background, faults, and associations.',
  },
  {
    type: 'kural', number: 973, chapter: 'Character Over Circumstance',
    tamil: 'மேலிருந்தும் மேலல்லார் மேலல்லர் கீழிருந்தும்\nகீழல்லார் கீழல் லவர்',
    tamilMeaning: 'மேல்நிலையில் இருந்தாலும் மேன்மைப் பண்பு இல்லாதவர் மேலானவர் அல்லர்; கீழ் நிலையில் இருந்தாலும் இழிகுணம் இல்லாதவர் கீழ் மக்கள் அல்லர்.',
    meaning: 'Being placed high does not make the unworthy great, and being brought low does not make the great unworthy.',
  },
  {
    type: 'kural', number: 991, chapter: 'The Grace of Approachability',
    tamil: 'எண்பதத்தால் எய்தல் எளிதென்ப யார்மாட்டும்\nபண்புடைமை என்னும் வழக்கு',
    tamilMeaning: 'பண்பு உடையவராக வாழும் நல்வழியை, யாரிடத்திலும் எளிய செவ்வியுடன் இருப்பதால் அடைவது எளிது என்று கூறுவர்.',
    meaning: 'Being easy to approach, for everyone, is the simplest path to the virtue we call true courtesy.',
  },

  // ── Indian Business Leaders ───────────────────────────────────────────────
  {
    type: 'quote',
    text: 'I don\'t believe in taking right decisions. I take decisions and then make them right.',
    author: 'Ratan Tata',
    role: 'Chairman Emeritus, Tata Group',
  },
  {
    type: 'quote',
    text: 'Ups and downs in life are very important to keep us going, because a straight line even in an ECG means we are not alive.',
    author: 'Ratan Tata',
    role: 'Chairman Emeritus, Tata Group',
  },
  {
    type: 'quote',
    text: 'Think big, think fast, think ahead. Ideas are no one\'s monopoly.',
    author: 'Dhirubhai Ambani',
    role: 'Founder, Reliance Industries',
  },
  {
    type: 'quote',
    text: 'Pursue your goals even in the face of difficulties, and convert adversities into opportunities.',
    author: 'Dhirubhai Ambani',
    role: 'Founder, Reliance Industries',
  },
  {
    type: 'quote',
    text: 'When you are small, you have to be very focused and rely on your brain, not your wallet.',
    author: 'Azim Premji',
    role: 'Founder, Wipro',
  },
  {
    type: 'quote',
    text: 'The most important quality for an entrepreneur is integrity — because that is what makes you trusted.',
    author: 'Narayana Murthy',
    role: 'Co-Founder, Infosys',
  },
  {
    type: 'quote',
    text: 'Our greatest strength is our ability to trust each other. The day we lose that, we lose everything.',
    author: 'Narayana Murthy',
    role: 'Co-Founder, Infosys',
  },

  // ── Global Business Leaders ───────────────────────────────────────────────
  {
    type: 'quote',
    text: 'It takes 20 years to build a reputation and five minutes to ruin it. If you think about that, you\'ll do things differently.',
    author: 'Warren Buffett',
    role: 'CEO, Berkshire Hathaway',
  },
  {
    type: 'quote',
    text: 'The best investment you can make is an investment in yourself. The more you learn, the more you earn.',
    author: 'Warren Buffett',
    role: 'CEO, Berkshire Hathaway',
  },
  {
    type: 'quote',
    text: 'Your brand is what people say about you when you\'re not in the room.',
    author: 'Jeff Bezos',
    role: 'Founder, Amazon',
  },
  {
    type: 'quote',
    text: 'We are stubborn on vision. We are flexible on details.',
    author: 'Jeff Bezos',
    role: 'Founder, Amazon',
  },
  {
    type: 'quote',
    text: 'Innovation distinguishes between a leader and a follower.',
    author: 'Steve Jobs',
    role: 'Co-Founder, Apple',
  },
  {
    type: 'quote',
    text: 'The only way to do great work is to love what you do. If you haven\'t found it yet, keep looking. Don\'t settle.',
    author: 'Steve Jobs',
    role: 'Co-Founder, Apple',
  },
  {
    type: 'quote',
    text: 'When something is important enough, you do it even if the odds are not in your favor.',
    author: 'Elon Musk',
    role: 'CEO, Tesla & SpaceX',
  },
  {
    type: 'quote',
    text: 'Today is hard, tomorrow will be worse, but the day after tomorrow will be sunshine.',
    author: 'Jack Ma',
    role: 'Co-Founder, Alibaba',
  },
  {
    type: 'quote',
    text: 'If you don\'t give up, you still have a chance. Giving up is the greatest failure.',
    author: 'Jack Ma',
    role: 'Co-Founder, Alibaba',
  },
  {
    type: 'quote',
    text: 'There is only one boss — the customer. They can fire everybody in the company simply by spending money somewhere else.',
    author: 'Sam Walton',
    role: 'Founder, Walmart',
  },
  {
    type: 'quote',
    text: 'Efficiency is doing things right. Effectiveness is doing the right things.',
    author: 'Peter Drucker',
    role: 'Father of Modern Management',
  },
  {
    type: 'quote',
    text: 'The best way to predict the future is to create it.',
    author: 'Peter Drucker',
    role: 'Father of Modern Management',
  },

  // ── Timeless Wisdom ───────────────────────────────────────────────────────
  {
    type: 'quote',
    text: 'Whether you think you can, or you think you can\'t — you\'re right.',
    author: 'Henry Ford',
    role: 'Founder, Ford Motor Company',
  },
  {
    type: 'quote',
    text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    author: 'Winston Churchill',
    role: 'Former Prime Minister, United Kingdom',
  },
  {
    type: 'quote',
    text: 'Give me six hours to chop down a tree and I will spend the first four sharpening the axe.',
    author: 'Abraham Lincoln',
    role: '16th President of the United States',
  },
  {
    type: 'quote',
    text: 'It does not matter how slowly you go, as long as you do not stop.',
    author: 'Confucius',
    role: 'Chinese Philosopher',
  },
  {
    type: 'quote',
    text: 'You have power over your mind, not outside events. Realize this, and you will find strength.',
    author: 'Marcus Aurelius',
    role: 'Roman Emperor & Stoic Philosopher',
  },

  // ── For the FMCG Distributor ──────────────────────────────────────────────
  {
    type: 'quote',
    text: 'Every delivery completed is a promise kept. Every customer satisfied is a business grown.',
    author: 'StockEz Wisdom',
    role: 'For FMCG Distributors',
  },
  {
    type: 'quote',
    text: 'A distributor\'s reputation is built one invoice at a time. Guard it like your most valuable stock.',
    author: 'StockEz Wisdom',
    role: 'For FMCG Distributors',
  },
  {
    type: 'quote',
    text: 'Stock that moves is money that earns. Stock that sits is money that sleeps.',
    author: 'StockEz Wisdom',
    role: 'For FMCG Distributors',
  },
  {
    type: 'quote',
    text: 'The salesperson who knows their customer\'s shelf better than the customer does will never lose the account.',
    author: 'StockEz Wisdom',
    role: 'For FMCG Distributors',
  },
  {
    type: 'quote',
    text: 'Cash flow is the heartbeat of distribution. Collect today; grow tomorrow.',
    author: 'StockEz Wisdom',
    role: 'For FMCG Distributors',
  },
];

const DailyKural: React.FC = () => {
  const [open, setOpen] = useState(false);

  const entry = useMemo(() => {
    const dayNum = dayjs().diff(dayjs().startOf('year'), 'day');
    return ENTRIES[dayNum % ENTRIES.length];
  }, []);

  useEffect(() => {
    if (!isAdmin()) return;
    const tenantId = localStorage.getItem('tenantId') || 'default';
    const today = dayjs().format('YYYY-MM-DD');
    if (localStorage.getItem(`kuralDate_${tenantId}`) !== today) {
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = () => {
    const tenantId = localStorage.getItem('tenantId') || 'default';
    localStorage.setItem(`kuralDate_${tenantId}`, dayjs().format('YYYY-MM-DD'));
    setOpen(false);
  };

  if (!open || !entry) return null;

  const isKural = entry.type === 'kural';
  const kural = isKural ? (entry as KuralEntry) : null;
  const quote = !isKural ? (entry as QuoteEntry) : null;
  const [line1, line2] = kural ? kural.tamil.split('\n') : ['', ''];

  return (
    <>
      <style>{`
        @keyframes kuralBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes kuralSlideUp {
          from { opacity: 0; transform: translateY(48px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes kuralFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .kural-backdrop { animation: kuralBackdropIn 0.3s ease both; }
        .kural-card     { animation: kuralSlideUp 0.5s cubic-bezier(0.34,1.45,0.64,1) both; }
        .kural-body1    { animation: kuralFadeUp 0.4s ease both; animation-delay: 0.28s; opacity: 0; }
        .kural-body2    { animation: kuralFadeUp 0.4s ease both; animation-delay: 0.44s; opacity: 0; }
        .kural-body3    { animation: kuralFadeUp 0.4s ease both; animation-delay: 0.58s; opacity: 0; }
        .kural-footer   { animation: kuralFadeUp 0.4s ease both; animation-delay: 0.70s; opacity: 0; }
        .kural-btn {
          height: 44px; padding: 0 32px; border-radius: 10px;
          border: none; background: #059669; color: #fff;
          font-size: 14px; font-weight: 700; cursor: pointer; letter-spacing: 0.3px;
          transition: background 0.18s, transform 0.14s, box-shadow 0.18s;
          box-shadow: 0 4px 16px rgba(5,150,105,0.38);
        }
        .kural-btn:hover  { background: #047857; transform: translateY(-2px); box-shadow: 0 7px 22px rgba(5,150,105,0.46); }
        .kural-btn:active { transform: translateY(0); }
      `}</style>

      <div
        className="kural-backdrop"
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(10,20,40,0.58)',
          backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          className="kural-card"
          onClick={e => e.stopPropagation()}
          style={{
            width: 520, maxWidth: '100%',
            borderRadius: 22, overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 28px 90px rgba(0,0,0,0.28)',
          }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #064e35 0%, #047857 55%, #059669 100%)',
            padding: '22px 28px 20px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -35, right: -35, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
            <div style={{ position: 'absolute', bottom: -25, left: '38%', width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 6 }}>
                {isKural ? 'Daily Wisdom · திருக்குறள்' : 'Daily Motivation'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>
                  {isKural ? kural!.chapter : quote!.author}
                </div>
                {isKural && (
                  <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)', flexShrink: 0, marginLeft: 12 }}>
                    #{kural!.number}
                  </div>
                )}
                {!isKural && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', flexShrink: 0, marginLeft: 12, maxWidth: 160, textAlign: 'right', lineHeight: 1.4 }}>
                    {quote!.role}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Kural layout ── */}
          {isKural && (
            <>
              <div className="kural-body1" style={{ padding: '28px 28px 20px', textAlign: 'center' }}>
                <div style={{
                  fontSize: 19, lineHeight: 2, color: '#0f172a', fontWeight: 600,
                  letterSpacing: 0.4, fontFamily: "'Latha', 'Vijaya', 'Tamil MN', serif",
                }}>
                  <div>"{line1}</div>
                  <div>{line2}"</div>
                </div>
              </div>

              <div style={{ margin: '0 28px', height: 1, background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)' }} />

              <div className="kural-body2" style={{ padding: '16px 28px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#059669', marginBottom: 6 }}>பொருள்</div>
                <div style={{ fontSize: 14, lineHeight: 1.75, color: '#334155', fontFamily: "'Latha', 'Vijaya', 'Tamil MN', serif" }}>
                  {kural!.tamilMeaning}
                </div>
              </div>

              <div className="kural-body3" style={{ padding: '14px 28px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>Meaning</div>
                <div style={{ fontSize: 14, lineHeight: 1.75, color: '#475569', fontStyle: 'italic' }}>
                  {kural!.meaning}
                </div>
              </div>
            </>
          )}

          {/* ── Quote layout ── */}
          {!isKural && (
            <>
              <div className="kural-body1" style={{ padding: '28px 28px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, lineHeight: 1, color: '#d1fae5', fontFamily: 'Georgia, serif', marginBottom: -10 }}>"</div>
                <div style={{ fontSize: 17, lineHeight: 1.8, color: '#0f172a', fontWeight: 600, letterSpacing: 0.1 }}>
                  {quote!.text}
                </div>
                <div style={{ fontSize: 48, lineHeight: 1, color: '#d1fae5', fontFamily: 'Georgia, serif', marginTop: -8, textAlign: 'right' }}>"</div>
              </div>

              <div style={{ margin: '0 28px', height: 1, background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)' }} />

              <div className="kural-body2" style={{ padding: '14px 28px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 16, color: '#059669', fontWeight: 800 }}>{quote!.author.charAt(0)}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{quote!.author}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{quote!.role}</div>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="kural-footer" style={{ padding: '24px 28px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <button className="kural-btn" onClick={handleClose}>Begin my day</button>
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
              {isKural ? 'Thiruvalluvar · Thirukkural' : 'StockEz · Daily Motivation'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DailyKural;
