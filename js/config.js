export const FREE_PLAY = {
  startBalance: 25,

  perkAt: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
};

export const STANDARD = {
  startBalance: 25,
  installments: [
    { amount: 30, minutes: 4 },
    { amount: 45, minutes: 4 },
    { amount: 70, minutes: 5 },
    { amount: 100, minutes: 6 },
    { amount: 150, minutes: 7 },
    { amount: 210, minutes: 8 },
    { amount: 300, minutes: 9 },
    { amount: 420, minutes: 10 },
  ],
};

export const TOTAL_DEBT = STANDARD.installments.reduce((sum, i) => sum + i.amount, 0);

export const HUSTLE = {
  payPerPlate: 1,
  cap: 10,
};

export const LUCK = { step: 0.05, cap: 0.3, cloverStep: 0.08, cloverCap: 0.4 };

export const BREAK_REMINDER_MINUTES = 30;
