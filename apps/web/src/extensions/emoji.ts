import { action, defineExtension, grid } from '@qikbar/qikbar'

const EMOJI: [string, string][] = [
  ['😀', 'grinning smile happy'], ['😂', 'joy tears laugh'], ['🥹', 'holding back tears'], ['😍', 'heart eyes love'], ['🤔', 'thinking hmm'],
  ['😎', 'cool sunglasses'], ['🥳', 'party celebrate'], ['😴', 'sleep tired'], ['🤯', 'mind blown'], ['😭', 'cry sob'],
  ['😅', 'sweat smile'], ['🙃', 'upside down'], ['😬', 'grimace awkward'], ['🫡', 'salute'], ['🤝', 'handshake deal'],
  ['👍', 'thumbs up yes ok'], ['👎', 'thumbs down no'], ['👏', 'clap applause'], ['🙌', 'raised hands hooray'], ['🙏', 'pray thanks please'],
  ['💪', 'muscle strong'], ['👀', 'eyes look'], ['🧠', 'brain smart'], ['❤️', 'heart love red'], ['🔥', 'fire hot lit'],
  ['✨', 'sparkles magic'], ['⭐', 'star'], ['⚡', 'zap lightning fast'], ['💯', 'hundred perfect'], ['✅', 'check done yes'],
  ['❌', 'cross no wrong'], ['⚠️', 'warning'], ['🚀', 'rocket launch ship'], ['🎉', 'tada party'], ['🎯', 'target goal'],
  ['💡', 'idea bulb'], ['📌', 'pin'], ['📎', 'paperclip attach'], ['📝', 'memo note write'], ['📅', 'calendar date'],
  ['📈', 'chart up growth'], ['📉', 'chart down'], ['💰', 'money bag'], ['💸', 'money flying'], ['🐛', 'bug'],
  ['🔧', 'wrench fix tool'], ['🔒', 'lock secure'], ['🔑', 'key'], ['🧪', 'test tube experiment'], ['🛠️', 'tools build'],
  ['📦', 'package box ship'], ['🗑️', 'trash delete'], ['🔍', 'search magnify'], ['💬', 'speech chat comment'], ['📣', 'megaphone announce'],
  ['☕', 'coffee'], ['🍕', 'pizza'], ['🌮', 'taco'], ['🍺', 'beer'], ['🎂', 'cake birthday'],
  ['🐶', 'dog puppy'], ['🐱', 'cat kitten'], ['🦄', 'unicorn'], ['🐙', 'octopus'], ['🦀', 'crab rust'],
  ['🌍', 'earth globe world'], ['🌙', 'moon night'], ['☀️', 'sun sunny'], ['🌈', 'rainbow'], ['❄️', 'snow cold'],
  ['⚽', 'soccer football'], ['🏀', 'basketball'], ['🎮', 'game controller'], ['🎵', 'music note'], ['🎨', 'art palette'],
  ['🏠', 'house home'], ['🏢', 'office building'], ['✈️', 'airplane travel'], ['🚗', 'car'], ['⏰', 'alarm clock time'],
]

export default defineExtension({
  name: 'emoji',
  title: 'Emoji',
  icon: '😀',
  description: 'Search and copy emoji.',
  commands: [
    {
      name: 'search',
      title: 'Search Emoji',
      icon: '😀',
      keywords: ['emoji', 'smiley', 'icon'],
      view: grid({
        title: 'Emoji',
        placeholder: 'Search emoji…',
        columns: 8,
        items: EMOJI.map(([char, names]) => ({
          title: names.split(' ')[0]!,
          keywords: names.split(' '),
          icon: char,
          actions: [
            action.copy(char, { title: 'Copy Emoji', shortcut: undefined }),
            {
              title: 'Paste into Search',
              icon: 'search',
              keepOpen: true,
              run: (ctx) => {
                ctx.setQuery(ctx.query + char)
                return false
              },
            },
          ],
        })),
      }),
    },
  ],
})
