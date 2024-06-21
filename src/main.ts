import { parse } from "./convert";

window.addEventListener('DOMContentLoaded', () => {
  const inputText = document.getElementById('inputText') as HTMLTextAreaElement;
  const inputSubmit = document.getElementById('inputSubmit') as HTMLButtonElement;
  const outputText = document.getElementById('outputText') as HTMLTextAreaElement;
  const doWrapCheckbox = document.getElementById('doWrapCheckbox') as HTMLInputElement;
  const verticalCheckbox = document.getElementById('verticalCheckbox') as HTMLInputElement;

  inputText.value = localStorage.getItem('inputText') || '';

  if (localStorage.getItem('doWrap') === 'true') {
    doWrapCheckbox.setAttribute('checked', '');
    inputText.wrap = 'soft';
    outputText.wrap = 'soft';
  } else {
    inputText.wrap = 'off';
    outputText.wrap = 'off';
  }
  if (localStorage.getItem('vertical') === 'true') {
    verticalCheckbox.setAttribute('checked', '');
    document.getElementById('inputOutputArea')?.classList.add('vertical');
  } else {
    document.getElementById('inputOutputArea')?.classList.add('horizontal');
  }

  inputText.onkeydown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      inputSubmit.click();
    } else if (!e.ctrlKey && !e.altKey && !e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      const start = inputText.selectionStart;
      const end = inputText.selectionEnd;
      inputText.value = inputText.value.substring(0, start) + '  ' + inputText.value.substring(end);
      inputText.selectionStart = inputText.selectionEnd = start + 2;
    }
  };

  inputSubmit.onclick = () => {
    localStorage.setItem('inputText', inputText.value);

    const result = parse(inputText.value);

    outputText.value = result;
  };

  inputText.onselect = () => {
    document.getElementById('inputSelectionRange')!.textContent = `start: ${inputText.selectionStart}, end: ${inputText.selectionEnd}`;
  }

  doWrapCheckbox.onclick = () => {
    localStorage.setItem('doWrap', doWrapCheckbox.checked.toString());
    inputText.wrap = doWrapCheckbox.checked ? 'soft' : 'off';
    outputText.wrap = doWrapCheckbox.checked ? 'soft' : 'off';
  };

  verticalCheckbox.onclick = () => {
    localStorage.setItem('vertical', verticalCheckbox.checked.toString());
    document.getElementById('inputOutputArea')?.classList.toggle('vertical');
    document.getElementById('inputOutputArea')?.classList.toggle('horizontal');
  };
});
