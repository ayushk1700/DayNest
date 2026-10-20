export function clockPresentation(now: number | Date, hour24: boolean) {
    const date = new Date(now), hour = date.getHours(), minute = date.getMinutes(), second = date.getSeconds();
    return {
        hours: String(hour24 ? hour : hour % 12 || 12).padStart(2, '0'),
        minutes: String(minute).padStart(2, '0'), seconds: String(second).padStart(2, '0'),
        period: hour24 ? '' : hour < 12 ? 'AM' : 'PM',
        hourAngle: (hour % 12 + minute / 60 + second / 3600) * 30,
        minuteAngle: (minute + second / 60) * 6, secondAngle: second * 6,
    };
}
