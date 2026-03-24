from datetime import date

from rest_framework import serializers


class ReportFilterSerializer(serializers.Serializer):
    user = serializers.IntegerField(required=False)
    project = serializers.IntegerField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    period = serializers.ChoiceField(choices=("custom", "week", "month"), default="custom")
    reference_date = serializers.DateField(required=False, default=date.today)
    group_by = serializers.ChoiceField(choices=("day", "week", "month"), default="week")
    export = serializers.ChoiceField(choices=("json", "csv"), default="json")

    def validate(self, attrs):
        period = attrs.get("period", "custom")
        reference_date = attrs.get("reference_date", date.today())
        date_from = attrs.get("date_from")
        date_to = attrs.get("date_to")

        if period == "week":
            start = date.fromordinal(reference_date.toordinal() - reference_date.weekday())
            attrs["date_from"] = start
            attrs["date_to"] = date.fromordinal(start.toordinal() + 6)
        elif period == "month":
            start = reference_date.replace(day=1)
            if start.month == 12:
                end = start.replace(year=start.year + 1, month=1, day=1)
            else:
                end = start.replace(month=start.month + 1, day=1)
            attrs["date_from"] = start
            attrs["date_to"] = date.fromordinal(end.toordinal() - 1)
        elif not (date_from and date_to):
            anchor = date_from or date_to or reference_date
            attrs["date_from"] = date_from or anchor
            attrs["date_to"] = date_to or anchor

        if attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError("date_from must be before or equal to date_to.")
        return attrs
