import { APP_TIMEZONE } from '../config/timezone';

type DateInput = Date | string | number | null | undefined;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime());
}

function toDateInstance(value: DateInput): Date {
    const date = value instanceof Date
        ? new Date(value.getTime())
        : value == null
            ? new Date()
            : new Date(value);

    if (!isValidDate(date)) {
        throw new Error(`Invalid date value: ${String(value)}`);
    }

    return date;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
    return parts.find((part) => part.type === type)?.value || '00';
}

function getBrazilDateTimeParts(value: DateInput) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(toDateInstance(value));

    return {
        year: getPart(parts, 'year'),
        month: getPart(parts, 'month'),
        day: getPart(parts, 'day'),
        hour: getPart(parts, 'hour'),
        minute: getPart(parts, 'minute'),
        second: getPart(parts, 'second'),
    };
}

function parseOffset(rawOffset: string): string {
    const match = rawOffset.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return '-03:00';

    const [, sign = '-', rawHours = '03', rawMinutes = '00'] = match;
    const hours = rawHours.padStart(2, '0');
    const minutes = rawMinutes.padStart(2, '0');
    return `${sign}${hours}:${minutes}`;
}

export function getBrazilUtcOffset(value: DateInput = new Date()): string {
    try {
        const offset = new Intl.DateTimeFormat('en-US', {
            timeZone: APP_TIMEZONE,
            timeZoneName: 'longOffset',
        }).formatToParts(toDateInstance(value)).find((part) => part.type === 'timeZoneName')?.value;

        if (offset) return parseOffset(offset);
    } catch (_error) {
        // Fallback for environments without longOffset support.
    }

    return '-03:00';
}

export function toBrazilDate(value: DateInput): string {
    if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value.trim())) {
        return value.trim();
    }

    const parts = getBrazilDateTimeParts(value);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toBrazilYearMonth(value: DateInput): string {
    if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value.trim())) {
        return value.trim().slice(0, 7);
    }

    const parts = getBrazilDateTimeParts(value);
    return `${parts.year}-${parts.month}`;
}

export function toBrazilIsoDateTime(value: DateInput = new Date()): string {
    const parts = getBrazilDateTimeParts(value);
    const offset = getBrazilUtcOffset(value);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}
