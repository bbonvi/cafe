import { HeaderModal } from "../base";

const faqTemplate = `
source code repository:
<br>
<a href="https://github.com/bonanov/bona.cafe" target="_blank"
>github.com/bonanov/bona.cafe</a>
<br>
original projects:
<br> 
<a href="https://github.com/cutechan/cutechan" target="_blank"
>github.com/cutechan/cutechan</a>
<br>
<a href="https://github.com/bakape/meguca" target="_blank"
>github.com/bakape/meguca</a>
<br>
`;
class FAQPanel extends HeaderModal {
  constructor() {
    super(
      document.querySelector(".faq-modal"),
      document.querySelector(".header-faq-icon"),
    );
  }

  protected showHook() {
    this.el.innerHTML = faqTemplate;
  }
}

export default FAQPanel;
