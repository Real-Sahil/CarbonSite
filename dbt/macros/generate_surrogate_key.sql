{# Generate a surrogate key from concatenated field values #}
{% macro generate_surrogate_key(fields) %}
  md5(cast(concatenate(
    {% for field in fields %}
      cast({{ field }} as varchar)
      {% if not loop.last %}, '_', {% endif %}
    {% endfor %}
  ) as varchar))
{% endmacro %}
