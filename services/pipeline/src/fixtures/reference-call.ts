import type { ScamStage } from '@scamshield/shared';

// Scripted calls for replay mode and for checking a scorer by hand. The scam
// follows the real MCMC-to-police call from the plan, one line per stage.

export interface ScriptLine {
  speaker: 'caller' | 'user';
  // The stage this line is meant to show; what a scorer should roughly return.
  stage: ScamStage;
  ms: string;
  en: string;
}

export const SCAM_CALL: ScriptLine[] = [
  {
    speaker: 'caller',
    stage: 'authority_setup',
    ms: 'Selamat pagi, saya dari MCMC. Nombor telefon encik telah didaftarkan di Sabah. Encik masih nak guna nombor ini? Sekejap ya, saya sambungkan encik kepada pihak polis.',
    en: 'Good morning, I am calling from MCMC. Your phone number has been registered in Sabah. Do you still want to use this number? One moment, I will transfer you to the police.',
  },
  {
    speaker: 'caller',
    stage: 'victim_framing',
    ms: 'Saya Inspektor Azman dari PDRM. Nombor encik telah digunakan untuk pengubahan wang haram. Kami percaya identiti encik telah dicuri, dan kami nak tolong encik bersihkan nama.',
    en: 'This is Inspector Azman from PDRM. Your number has been used for money laundering. We believe your identity was stolen, and we want to help you clear your name.',
  },
  {
    speaker: 'caller',
    stage: 'family_pressure',
    ms: 'Kalau encik tak beri kerjasama, ibu bapa encik pun akan disiasat. Jangan beritahu sesiapa tentang kes ini, ini siasatan sulit.',
    en: 'If you do not cooperate, your parents will be investigated too. Do not tell anyone about this case, it is a confidential investigation.',
  },
  {
    speaker: 'caller',
    stage: 'isolation',
    ms: 'Jangan letak telefon. Encik kena terus dalam talian sampai siasatan ini selesai.',
    en: 'Do not hang up. You must stay on the line until this investigation is finished.',
  },
  {
    speaker: 'caller',
    stage: 'identity_request',
    ms: 'Sila hantar gambar kad pengenalan encik, depan dan belakang, melalui WhatsApp sekarang.',
    en: 'Please send a photo of your IC, front and back, through WhatsApp now.',
  },
  {
    speaker: 'user',
    stage: 'identity_request',
    ms: 'Baik tuan, saya hantar sekarang.',
    en: 'Okay sir, I am sending it now.',
  },
  {
    speaker: 'caller',
    stage: 'financial_request',
    ms: 'Untuk lindungi duit encik, pindahkan semua baki ke akaun selamat Bank Negara sekarang juga. Lepas itu berikan nombor TAC yang encik terima.',
    en: 'To protect your money, transfer your whole balance to the Bank Negara safe account right now. Then give me the TAC number you receive.',
  },
];

// Calls that must stay quiet.
export const NORMAL_CALLS: Record<string, ScriptLine[]> = {
  family: [
    {
      speaker: 'caller',
      stage: 'none',
      ms: 'Hai mak, adik dah sampai rumah. Malam ni nak makan apa? Nanti adik singgah kedai beli ayam.',
      en: 'Hi mum, I am home already. What do you want for dinner tonight? I will stop by the shop and buy chicken.',
    },
  ],
  bank_callback: [
    {
      speaker: 'caller',
      stage: 'none',
      ms: 'Selamat petang, saya dari Maybank. Kami nak sahkan transaksi kad encik di Shopee sebanyak RM120 semalam. Encik ada buat transaksi ini? Baik, terima kasih, tiada tindakan lanjut diperlukan.',
      en: 'Good afternoon, I am calling from Maybank. We want to confirm a card transaction at Shopee for RM120 yesterday. Did you make this transaction? Okay, thank you, no further action is needed.',
    },
  ],
  delivery: [
    {
      speaker: 'caller',
      stage: 'none',
      ms: 'Hello, saya rider J&T. Barang encik dah sampai, saya ada depan rumah. Boleh keluar ambil?',
      en: 'Hello, I am the J&T rider. Your parcel has arrived, I am in front of your house. Can you come out and collect it?',
    },
  ],
};
