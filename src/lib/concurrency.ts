export const mapConcurrent = async <Input, Output>(
    values: Iterable<Input>,
    concurrency: number,
    transform: (value: Input) => Promise<Output>,
): Promise<Output[]> => {
    const items = [...values];
    const results: Output[] = [];
    let next = 0;

    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await transform(items[index]!);
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
};

export const createLimiter = (concurrency: number) => {
    let active = 0;
    const waiting: (() => void)[] = [];

    return async <Value>(operation: () => Promise<Value>): Promise<Value> => {
        if (active < concurrency) active++;
        else await new Promise<void>((resolve) => waiting.push(resolve));
        try {
            return await operation();
        } finally {
            const next = waiting.shift();
            if (next) next();
            else active--;
        }
    };
};
