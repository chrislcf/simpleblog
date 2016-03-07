var renderPreview = function () {
  $('#preview').html(marked($('#content').val()));
};

$('#generate').click(function () {
  $.post('/scrypt', {
    password: $('#password').val()
  }, function (data) {
    prompt('Please copy and paste into config.json, then restart npm', data.hash);
  });
});

$('#content').keyup(renderPreview);
$(function () {
  renderPreview();
})
