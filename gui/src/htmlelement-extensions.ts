HTMLElement.prototype.toggleMultiple = function (...classes) {
    for (const className of classes) {
        this.classList.toggle(className);
    }
};

HTMLElement.prototype.secondHighestParent = function (childElement: HTMLElement) {
    if (!childElement) {
        return childElement;
    }

    let parent: HTMLElement = childElement.parentElement as HTMLElement;
    let previous: HTMLElement = childElement;

    while (parent !== this) {
        previous = parent;
        parent = parent.parentElement as HTMLElement;
    }

    return previous;
};

HTMLTextAreaElement.prototype.calculateHeight = function () {
    const lineBreaks: number = this.value.count("\n") + 1;

    const {
        lineHeight,
        paddingTop,
        paddingBottom,
        borderTopWidth,
        borderBottomWidth,
    }: {
        lineHeight: string;
        paddingTop: string;
        paddingBottom: string;
        borderTopWidth: string;
        borderBottomWidth: string;
    } = window.getComputedStyle(this);

    const newHeight: number =
        lineBreaks * Number.parseFloat(lineHeight) +
        Number.parseFloat(paddingTop) +
        Number.parseFloat(paddingBottom) +
        Number.parseFloat(borderTopWidth) +
        Number.parseFloat(borderBottomWidth);

    for (const child of this?.parentElement?.children ?? []) {
        (child as HTMLElement).style.height = `${newHeight}px`;
    }
};
