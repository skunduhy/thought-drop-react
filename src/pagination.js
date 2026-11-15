export const PAGE_BREAK_MARKER = '[page break]'
export const PAGE_CHANGE_EVENT = 'thought-drop:page-change'

export function messageBlocks(message) {
  let firstParagraph = true
  return message.replace(/\r\n?/g, '\n').split('\n').flatMap((line) => {
    const text = line.trim()
    if (!text) return []
    if (text === PAGE_BREAK_MARKER) return [{ type: 'break' }]
    const block = { type: 'paragraph', text, opening: firstParagraph }
    firstParagraph = false
    return [block]
  })
}

function blockElement(block) {
  const element = document.createElement(block.type === 'title' ? 'h1' : block.type === 'ornament' ? 'div' : 'p')
  element.textContent = block.text
  if (block.type === 'title') element.className = 'page-title'
  else if (block.type === 'ornament') element.className = 'fleuron'
  else if (block.type === 'greeting') element.className = 'page-greeting'
  else if (block.type === 'signature') element.className = 'page-signature'
  else element.className = block.opening ? 'page-opening' : block.continued ? 'page-continuation' : 'page-paragraph'
  return element
}

// Measure with the same styles and available height as the visible book page.
export function paginateBlocks(blocks, container) {
  const pages = []
  let current = []
  container.replaceChildren()
  const fits = () => container.scrollHeight <= container.clientHeight
  const nextPage = () => {
    if (current.length) pages.push(current)
    current = []
    container.replaceChildren()
  }

  try {
    for (const block of blocks) {
      if (block.type === 'break') {
        nextPage()
        continue
      }
      let remaining = block
      while (remaining) {
        const element = blockElement(remaining)
        container.append(element)
        if (fits()) {
          current.push(remaining)
          break
        }
        if (remaining.type !== 'paragraph') {
          element.remove()
          if (!current.length) throw new Error('A heading or greeting is too large for the book page.')
          nextPage()
          continue
        }

        let tokens = remaining.text.match(/\S+\s*/gu) || []
        function fittingPrefix() {
          let low = 0
          let high = tokens.length
          while (low < high) {
            const middle = Math.ceil((low + high) / 2)
            element.textContent = tokens.slice(0, middle).join('').trimEnd()
            if (fits()) low = middle
            else high = middle - 1
          }
          return low
        }
        let count = fittingPrefix()
        if (!count && !current.length) {
          tokens = Array.from(remaining.text)
          count = fittingPrefix()
        }
        if (!count) {
          element.remove()
          if (!current.length) throw new Error('The book page is too small to fit the message.')
          nextPage()
          continue
        }
        const text = tokens.slice(0, count).join('').trimEnd()
        current.push({ ...remaining, text })
        const rest = tokens.slice(count).join('').trimStart()
        remaining = rest ? { ...remaining, text: rest, opening: false, continued: true } : null
        nextPage()
      }
    }
    nextPage()
    return pages
  } finally {
    container.replaceChildren()
  }
}
