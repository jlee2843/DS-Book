"""Asset recovery must preserve cached pages without overwriting the new release."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'retention', Path(__file__).resolve().parents[1] / 'scripts/retain_site_assets.py')
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)


class LiveAssetRecoveryTests(unittest.TestCase):
    def test_document_paths_module_imports_and_runtime_templates(self):
        source = '''import "./child.reader-abc.js";
        href:"myst-theme.abc.css";
        `${r??""}/thebe-core.min.reader-abc.js`;
        import "https://other.test/private.reader-abc.js";'''
        self.assertEqual(retention.linked_assets(
            source, 'https://example.test/build/entry.js', 'https://example.test/'),
            {'build/child.reader-abc.js', 'myst-theme.abc.css', 'thebe-core.min.reader-abc.js'})

    def fixture(self):
        base = 'https://example.test/'
        return base, {
            base: b'<script src="/build/entry.reader-abc.js"></script>',
            base+'retained-assets.json': json.dumps({
                'old.reader-def.js': 1, 'expired.reader-ghi.js': 3,
                '../escape.js': 1, 'https://other.test/private.js': 1}).encode(),
            base+'build/entry.reader-abc.js': b'import "./child.reader-abc.js";',
            base+'build/child.reader-abc.js': b'export const child=1;',
            base+'old.reader-def.js': b'export const old=1;',
        }

    def test_dependency_closure_ages_and_current_release_preserved(self):
        base, files = self.fixture()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root/'build').mkdir()
            entry = root/'build/entry.reader-abc.js'
            entry.write_text('current release')
            retention.merge_live_site(root, base, files.__getitem__)
            ages = json.loads((root/'retained-assets.json').read_text())
            self.assertEqual(ages, {'build/child.reader-abc.js': 1, 'old.reader-def.js': 2})
            self.assertEqual(entry.read_text(), 'current release')
            self.assertFalse((root/'expired.reader-ghi.js').exists())

    def test_missing_dependency_does_not_leave_partial_recovery(self):
        base, files = self.fixture()
        del files[base+'build/child.reader-abc.js']
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaises(KeyError):
                retention.merge_live_site(root, base, files.__getitem__)
            self.assertEqual(list(root.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
