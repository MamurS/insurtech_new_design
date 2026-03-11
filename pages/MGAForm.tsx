import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../theme/useTheme';
import { usePageHeader } from '../context/PageHeaderContext';
import { ArrowLeft } from 'lucide-react';
import { MGAFormContent } from '../components/MGAFormContent';

const MGAForm: React.FC = () => {
  const { t } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setHeaderLeft } = usePageHeader();
  const isEdit = Boolean(id);

  React.useEffect(() => {
    setHeaderLeft(
      <button
        onClick={() => navigate('/mga')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.text3, fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = t.text1)}
        onMouseLeave={(e) => (e.currentTarget.style.color = t.text3)}
      >
        <ArrowLeft size={16} />
        Back to MGA
      </button>
    );
    return () => setHeaderLeft(null);
  }, [setHeaderLeft, navigate, t]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text1 }}>
          {isEdit ? 'Edit Binding Agreement' : 'New Binding Agreement'}
        </h2>
        <p style={{ fontSize: 13, color: t.text4, marginTop: 2 }}>MGA / Binding Authority</p>
      </div>
      <MGAFormContent
        id={id}
        onSave={() => navigate('/mga')}
        onCancel={() => navigate('/mga')}
      />
    </div>
  );
};

export default MGAForm;
