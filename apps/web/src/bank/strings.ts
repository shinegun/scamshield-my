import type { Lang } from '../call/labels';

// Fixed text of the bank app screens other than the hold screen (see explain.ts),
// so a Malay call gets a Malay bank. Validation errors from bankMachine stay English.
export interface BankStrings {
  titles: Record<'home' | 'form' | 'pending' | 'completed' | 'confirm' | 'countdown' | 'releasing' | 'released', string>;
  back: string;
  close: string;
  accounts: string;
  accountName: string;
  availableBalance: string;
  callEnded: string;
  transferMoney: string;
  recipient: string;
  recipientPlaceholder: string;
  amount: string;
  transferFrom: string;
  suggested: string;
  sendTransfer: string;
  to: string;
  newBalance: string;
  done: string;
  confirmText: string;
  goBack: string;
  nobodyAsked: string;
  releasedIn(amount: string, toAccount: string): string;
  coolingOff: string;
  cancel: string;
  quickRecipients: string[];
}

const STRINGS: Record<Lang, BankStrings> = {
  en: {
    titles: {
      home: 'DemoBank',
      form: 'Transfer money',
      pending: 'Sending transfer…',
      completed: 'Transfer sent',
      confirm: 'Before you continue',
      countdown: 'Releasing transfer',
      releasing: 'Releasing transfer…',
      released: 'Transfer released',
    },
    back: '‹ Back',
    close: 'Close',
    accounts: 'Accounts',
    accountName: 'Savings Account',
    availableBalance: 'Available balance',
    callEnded: 'The call has ended. Start a new call to try a transfer.',
    transferMoney: 'Transfer money',
    recipient: 'Recipient',
    recipientPlaceholder: 'Recipient account',
    amount: 'Amount (RM)',
    transferFrom: 'Transfer from',
    suggested: 'Suggested',
    sendTransfer: 'Send transfer',
    to: 'To',
    newBalance: 'New balance',
    done: 'Done',
    confirmText:
      'Scammers often tell you to say this. Only continue if nobody on a call asked you to make this transfer.',
    goBack: 'Go back',
    nobodyAsked: 'Nobody asked me to, continue',
    releasedIn: (amount, to) => `${amount} to ${to} will be released in`,
    coolingOff: 'In production this cooling-off period would be 24 hours.',
    cancel: 'Cancel',
    quickRecipients: ['Mum', 'Landlord', 'Bank Negara safe account'],
  },
  ms: {
    titles: {
      home: 'DemoBank',
      form: 'Pindahan wang',
      pending: 'Menghantar pindahan…',
      completed: 'Pindahan dihantar',
      confirm: 'Sebelum anda teruskan',
      countdown: 'Melepaskan pindahan',
      releasing: 'Melepaskan pindahan…',
      released: 'Pindahan dilepaskan',
    },
    back: '‹ Kembali',
    close: 'Tutup',
    accounts: 'Akaun',
    accountName: 'Akaun Simpanan',
    availableBalance: 'Baki tersedia',
    callEnded: 'Panggilan telah tamat. Mulakan panggilan baharu untuk mencuba pindahan.',
    transferMoney: 'Pindah wang',
    recipient: 'Penerima',
    recipientPlaceholder: 'Akaun penerima',
    amount: 'Jumlah (RM)',
    transferFrom: 'Pindahan dari',
    suggested: 'Cadangan',
    sendTransfer: 'Hantar pindahan',
    to: 'Kepada',
    newBalance: 'Baki baharu',
    done: 'Selesai',
    confirmText:
      'Penipu selalunya menyuruh anda berkata begini. Teruskan hanya jika tiada sesiapa dalam panggilan yang menyuruh anda membuat pindahan ini.',
    goBack: 'Kembali',
    nobodyAsked: 'Tiada siapa suruh saya, teruskan',
    releasedIn: (amount, to) => `${amount} ke ${to} akan dilepaskan dalam`,
    coolingOff: 'Dalam sistem sebenar, tempoh bertenang ini ialah 24 jam.',
    cancel: 'Batal',
    quickRecipients: ['Mak', 'Tuan rumah', 'Akaun selamat Bank Negara'],
  },
};

export const bankStrings = (lang: Lang = 'en'): BankStrings => STRINGS[lang];
