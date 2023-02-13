export const iterPages = (
  currentPage: number,
  totalPages: number,
): (number | undefined)[] => {
  return [...iterPagesGenerator(currentPage, totalPages)];
}

function* iterPagesGenerator(
  currentPage: number,
  totalPages: number,
): Generator<number | undefined> {
  const leftEdge = 2;
  const leftCurrent = 1;
  const rightCurrent = 1;
  const rightEdge = 2;
  
  const pagesEnd = totalPages + 1;
  if (pagesEnd === 1) {
    return;
  }
  
  const leftEnd = Math.min(1 + leftEdge, pagesEnd);
  for (let i = 1; i < leftEnd; i++) {
    yield i;
  }
  
  if (leftEnd === pagesEnd) {
    return;
  }
  
  const midStart = Math.max(leftEnd, currentPage - leftCurrent);
  const midEnd = Math.min(currentPage + rightCurrent + 1, pagesEnd);
  
  if (midStart > leftEnd) {
    yield undefined;
  }

  for (let i = midStart; i < midEnd; i++) {
    yield i;
  }
  
  if (midEnd === pagesEnd) {
    return;
  }
  
  const rightStart = Math.max(midEnd, pagesEnd - rightEdge);
  
  if (rightStart > midEnd) {
    yield undefined;
  }

  for (let i = rightStart; i < pagesEnd; i++) {
    yield i;
  }
}
