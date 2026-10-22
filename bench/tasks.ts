/**
 * Realistic form texts for the comparison. "tune" tasks may be used to adjust
 * the server prompt; results are reported on the "held-out" tasks only.
 */
export interface Task {
  id: string
  split: "tune" | "held-out"
  /** The field label sent to the model as context. */
  context: string
  /** The text the simulated user means to write. */
  target: string
}

export const tasks: Task[] = [
  {
    id: "support-reply",
    split: "tune",
    context: "Reply to a customer support ticket",
    target:
      "Hi Daniel, thank you for reaching out. I checked your account and the refund for order 48213 was issued on March 3. It usually takes five to seven business days to appear on your card statement. Let me know if you have any other questions.",
  },
  {
    id: "bug-report",
    split: "tune",
    context: "Bug report: what happened",
    target:
      "When I upload a PNG larger than 10 MB on the profile page, the spinner keeps going and nothing happens. The console shows a 413 error from the upload endpoint. Smaller files work fine in Chrome and Firefox.",
  },
  {
    id: "cover-letter",
    split: "held-out",
    context: "Cover letter: opening paragraph",
    target:
      "Dear hiring team, I am writing to apply for the Senior Frontend Engineer position at Northwind. For the past six years I have built design systems and data-heavy dashboards in React, and I would love to bring that experience to your analytics team.",
  },
  {
    id: "grant-summary",
    split: "held-out",
    context: "Grant application: project summary",
    target:
      "We will open a community repair café in the old library building, where volunteers help residents fix electronics, clothes, and bicycles. The project aims to reduce waste and teach practical skills to young people in the district.",
  },
  {
    id: "delivery-delay-ru",
    split: "held-out",
    context: "Ответ клиенту о задержке доставки",
    target:
      "Здравствуйте, Ольга! Приносим извинения за задержку доставки. Ваш заказ уже передан в службу доставки и будет у вас в четверг до 18:00. В качестве компенсации мы начислили вам 500 бонусных баллов.",
  },
  {
    id: "product-ru",
    split: "held-out",
    context: "Описание товара для маркетплейса",
    target:
      "Лёгкий рюкзак для города и коротких поездок. Отделение для ноутбука до 15 дюймов, водоотталкивающая ткань и скрытый карман для документов на спинке. Объём 22 литра, вес 650 грамм.",
  },
]
